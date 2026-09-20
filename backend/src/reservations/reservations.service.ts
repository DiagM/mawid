import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { getBookingRules } from './booking-rules';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import {
  addMinutes,
  localDayRangeUtc,
  utcToLocalDate,
  utcToLocalTime,
} from '../common/time/algiers-time';
import { currentLocalMonthRange } from '../common/month-range';
import { buildQuotaStatus, type QuotaStatus } from '../common/plans';

/** Code Postgres d'une violation de contrainte d'exclusion. */
const PG_EXCLUSION_VIOLATION = '23P01';

/**
 * Détecte une violation de la contrainte anti-chevauchement.
 *
 * Prisma n'expose pas ce code dans une erreur typée : il faut fouiller la
 * cause d'origine remontée par le driver pg. On reste tolérant sur la forme
 * pour ne pas transformer une collision légitime en 500.
 */
function isOverlapViolation(error: unknown): boolean {
  const candidates: unknown[] = [error];

  if (error !== null && typeof error === 'object') {
    const withCause = error as { cause?: unknown; meta?: unknown };
    if (withCause.cause !== undefined) {
      candidates.push(withCause.cause);
    }
    if (withCause.meta !== null && typeof withCause.meta === 'object') {
      candidates.push(withCause.meta);
    }
  }

  return candidates.some((candidate) => {
    if (candidate === null || typeof candidate !== 'object') {
      return false;
    }
    const record = candidate as { code?: unknown; message?: unknown };
    if (record.code === PG_EXCLUSION_VIOLATION) {
      return true;
    }
    return (
      typeof record.message === 'string' &&
      record.message.includes('reservations_no_overlap')
    );
  });
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  // ============================================
  // Parcours client (public, sans authentification)
  // ============================================

  /**
   * Crée une réservation pour un salon public.
   *
   * Tout ce qui vient du client est recalculé : le salon vient du slug, les
   * durées et prix viennent de la base, la ressource est choisie par le
   * moteur de disponibilité. Le client ne maîtrise que son créneau souhaité,
   * son prénom et son numéro.
   */
  async createForSalon(slug: string, dto: CreateReservationDto) {
    const context = await this.availability.resolveContext(
      slug,
      dto.prestationIds,
    );

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Créneau invalide');
    }

    const employeeId = await this.availability.resolveResourceForSlot(
      context,
      startsAt,
      new Date(),
      dto.employeeId,
    );
    const endsAt = addMinutes(startsAt, context.totalDurationMinutes);

    const client = await this.upsertClient(
      dto.clientPhone,
      dto.clientFirstName,
    );

    await this.assertNotBlocked(client, context.salonId);

    await this.assertPhoneQuotas(client.id, context.salonId);
    await this.assertSalonQuota(context.salonId);

    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        return tx.reservation.create({
          data: {
            salonId: context.salonId,
            employeeId,
            startsAt,
            endsAt,
            clientId: client.id,
            // Snapshots : corriger la fiche client plus tard ne doit pas
            // réécrire l'historique de ce RDV.
            clientFirstName: dto.clientFirstName,
            clientPhone: dto.clientPhone,
            reservationPrestations: {
              create: context.prestations.map((prestation) => ({
                prestationId: prestation.id,
                nameSnapshot: prestation.name,
                priceCentsSnapshot: prestation.priceCents,
                durationMinutesSnapshot: prestation.durationMinutes,
              })),
            },
          },
          include: { reservationPrestations: true },
        });
      });

      return this.toClientView(reservation, true);
    } catch (error) {
      // Deux clients ont cliqué sur le même créneau au même instant : la base
      // a tranché. C'est un conflit métier normal, pas une erreur serveur.
      if (isOverlapViolation(error)) {
        throw new ConflictException(
          "Ce créneau vient d'être réservé. Choisissez-en un autre.",
        );
      }
      throw error;
    }
  }

  /**
   * Consultation d'une réservation via son token d'annulation.
   *
   * Le token est un secret porteur : il donne accès sans authentification.
   * On n'expose donc que le strict nécessaire à l'affichage de la page de
   * gestion — jamais la note interne, jamais d'identifiant technique de salon.
   */
  async findByToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancellationToken: token },
      include: {
        reservationPrestations: true,
        salon: { select: { name: true, slug: true, contactPhone: true } },
        // Présence d'un avis, pour que la page de gestion sache s'il faut
        // proposer le formulaire ou remercier le client.
        review: { select: { id: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    return {
      ...this.toClientView(reservation, false),
      hasReview: reservation.review !== null,
    };
  }

  /** Annulation par le client, via son lien de gestion. */
  async cancelByToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancellationToken: token },
      select: { id: true, status: true, startsAt: true },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (reservation.status === 'CANCELED') {
      throw new BadRequestException('Cette réservation est déjà annulée');
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Cette réservation ne peut plus être annulée',
      );
    }

    if (reservation.startsAt.getTime() <= Date.now()) {
      // Annuler après coup fausserait les statistiques de no-show : c'est au
      // gérant de qualifier ce qui s'est réellement passé.
      throw new BadRequestException(
        'Ce rendez-vous est passé. Contactez le salon.',
      );
    }

    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELED' },
    });

    return { status: 'CANCELED' as const };
  }

  // ============================================
  // Parcours gérant (protégé par JWT)
  // ============================================

  /**
   * Agenda du salon du gérant connecté.
   * Le salon est retrouvé par `ownerId`, jamais via un identifiant fourni par
   * l'appelant — c'est la seule isolation entre salons (pas de RLS).
   */
  async findMine(userId: string, from?: string, to?: string) {
    const salon = await this.getOwnedSalon(userId);

    const today = utcToLocalDate(new Date());
    const startDate = from ?? today;
    const endDate = to ?? startDate;

    const { start } = localDayRangeUtc(startDate);
    const { end } = localDayRangeUtc(endDate);

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId: salon.id,
        startsAt: { gte: start, lt: end },
      },
      orderBy: { startsAt: 'asc' },
      include: { reservationPrestations: true },
    });

    return reservations.map((reservation) => ({
      id: reservation.id,
      startsAt: reservation.startsAt.toISOString(),
      endsAt: reservation.endsAt.toISOString(),
      localDate: utcToLocalDate(reservation.startsAt),
      localTime: utcToLocalTime(reservation.startsAt),
      status: reservation.status,
      employeeId: reservation.employeeId,
      clientFirstName: reservation.clientFirstName,
      clientPhone: reservation.clientPhone,
      internalNote: reservation.internalNote,
      prestations: reservation.reservationPrestations.map((line) => ({
        name: line.nameSnapshot,
        priceCents: line.priceCentsSnapshot,
        durationMinutes: line.durationMinutesSnapshot,
      })),
      totalPriceCents: reservation.reservationPrestations.reduce(
        (total, line) => total + line.priceCentsSnapshot,
        0,
      ),
    }));
  }

  /** Qualifie un RDV : honoré, non présenté, ou annulé par le salon. */
  async updateStatus(
    userId: string,
    reservationId: string,
    dto: UpdateReservationStatusDto,
  ) {
    const salon = await this.getOwnedSalon(userId);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, salonId: true, status: true },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (reservation.salonId !== salon.id) {
      throw new ForbiddenException("Vous n'avez pas accès à cette réservation");
    }

    if (reservation.status === dto.status) {
      throw new BadRequestException('Ce statut est déjà appliqué');
    }

    return this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: dto.status,
        ...(dto.internalNote !== undefined && {
          internalNote: dto.internalNote,
        }),
      },
    });
  }

  // ============================================
  // Helpers privés
  // ============================================

  /**
   * Retrouve ou crée la fiche client rattachée à un numéro.
   * Le téléphone est la clé naturelle : un numéro = une personne.
   */
  /**
   * Quota mensuel du salon selon son offre (business plan §8.1).
   *
   * ⚠️ C'est la seule règle du produit qui refuse un client pour une raison
   * qui ne le concerne pas. Le message ne lui reproche donc rien et le
   * renvoie vers le salon, qui peut toujours le prendre par téléphone — la
   * réservation en ligne est bloquée, pas le rendez-vous lui-même.
   */
  private async assertSalonQuota(salonId: string) {
    const quota = await this.quotaForSalon(salonId);

    if (quota.isExceeded) {
      throw new ForbiddenException(
        'Ce salon a atteint sa limite de réservations en ligne pour ce mois-ci. ' +
          'Contactez-le directement par téléphone.',
      );
    }
  }

  /**
   * Consommation du quota mensuel d'un salon.
   *
   * Les réservations annulées ne sont pas comptées : un client qui réserve
   * puis se décommande ne doit pas amputer le quota du salon, qui n'a rien
   * consommé. On compte sur `createdAt` et non `startsAt`, parce que c'est
   * l'acte de réserver qui est facturé, pas la date du rendez-vous.
   */
  async quotaForSalon(salonId: string): Promise<QuotaStatus> {
    const { start, end } = currentLocalMonthRange();

    const [salon, used] = await Promise.all([
      this.prisma.salon.findUnique({
        where: { id: salonId },
        select: { plan: true },
      }),
      this.prisma.reservation.count({
        where: {
          salonId,
          status: { not: 'CANCELED' },
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);

    if (!salon) {
      throw new NotFoundException('Salon introuvable');
    }

    return buildQuotaStatus(salon.plan, used, end);
  }

  /** Quota du salon du gérant connecté. */
  async quotaForManager(userId: string): Promise<QuotaStatus> {
    const salon = await this.getOwnedSalon(userId);
    return this.quotaForSalon(salon.id);
  }

  /**
   * Plafonds par numéro de téléphone.
   *
   * Pourquoi en base et non dans le throttler : l'IP est une mauvaise clé en
   * Algérie, où les opérateurs mobiles partagent les IP publiques entre de
   * nombreux abonnés (CGNAT). Un plafond par IP assez strict pour gêner un
   * abuseur bloquerait aussi de vrais clients. Le numéro est la bonne clé, et
   * la base est le bon endroit : le compteur survit à un redémarrage et reste
   * valable si le service tourne un jour sur plusieurs instances — ce que le
   * stockage mémoire du throttler ne garantit ni l'un ni l'autre.
   *
   * Le throttling par IP est conservé en parallèle, mais volontairement large :
   * il ne sert plus qu'à absorber un flood brutal.
   */
  private async assertPhoneQuotas(clientId: string, salonId: string) {
    const rules = getBookingRules();
    const now = new Date();

    const [upcomingInSalon, createdToday] = await Promise.all([
      // Saturer un agenda suppose de détenir beaucoup de RDV à venir dans CE
      // salon : c'est précisément ce que ce plafond rend impossible.
      this.prisma.reservation.count({
        where: {
          clientId,
          salonId,
          status: 'CONFIRMED',
          startsAt: { gt: now },
        },
      }),
      // Plafond global, tous salons confondus : vise le spam en rafale.
      this.prisma.reservation.count({
        where: {
          clientId,
          createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    if (upcomingInSalon >= rules.maxUpcomingPerPhonePerSalon) {
      throw new ForbiddenException(
        `Vous avez déjà ${upcomingInSalon} rendez-vous à venir dans ce salon. ` +
          'Annulez-en un ou contactez directement le salon.',
      );
    }

    if (createdToday >= rules.maxPerPhonePerDay) {
      throw new ForbiddenException(
        'Trop de réservations depuis ce numéro aujourd’hui. Réessayez demain ' +
          'ou contactez directement le salon.',
      );
    }
  }

  /**
   * Deux blocages distincts, refusés du même message.
   *
   * `Client.isBlocked` est un bannissement de la PLATEFORME, décidé par
   * Mawid. `SalonBlockedClient` est local : un salon refuse quelqu'un chez
   * lui sans l'exclure des autres, ce qui serait lui donner un pouvoir qui
   * n'est pas le sien.
   *
   * Le message est neutre et identique dans les deux cas : confirmer à un
   * abuseur qu'il est bloqué, et par qui, lui apprend seulement à changer de
   * numéro ou de salon.
   */
  private async assertNotBlocked(
    client: { id: string; isBlocked: boolean },
    salonId: string,
  ) {
    if (!client.isBlocked) {
      const locally = await this.prisma.salonBlockedClient.findUnique({
        where: { salonId_clientId: { salonId, clientId: client.id } },
        select: { id: true },
      });

      if (!locally) {
        return;
      }
    }

    throw new ForbiddenException(
      'Réservation impossible. Contactez directement le salon.',
    );
  }

  private async upsertClient(phone: string, firstName: string) {
    return this.prisma.client.upsert({
      where: { phone },
      // On rafraîchit le prénom : c'est la dernière information connue.
      // L'historique reste protégé par les snapshots sur la réservation.
      update: { firstName },
      create: { phone, firstName },
      select: { id: true, isBlocked: true },
    });
  }

  private async getOwnedSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    return salon;
  }

  /**
   * Vue destinée au client final.
   *
   * @param includeToken n'est vrai qu'à la création : c'est le seul moment où
   * le client doit recevoir son token, pour construire son lien de gestion.
   * Le relire ensuite depuis une réponse d'API n'apporterait rien et
   * multiplierait les occasions de le laisser fuiter.
   */
  private toClientView(
    reservation: {
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
      cancellationToken: string;
      clientFirstName: string;
      reservationPrestations: {
        nameSnapshot: string;
        priceCentsSnapshot: number;
        durationMinutesSnapshot: number;
      }[];
      salon?: { name: string; slug: string; contactPhone: string };
    },
    includeToken: boolean,
  ) {
    return {
      id: reservation.id,
      startsAt: reservation.startsAt.toISOString(),
      endsAt: reservation.endsAt.toISOString(),
      localDate: utcToLocalDate(reservation.startsAt),
      localTime: utcToLocalTime(reservation.startsAt),
      status: reservation.status,
      clientFirstName: reservation.clientFirstName,
      prestations: reservation.reservationPrestations.map((line) => ({
        name: line.nameSnapshot,
        priceCents: line.priceCentsSnapshot,
        durationMinutes: line.durationMinutesSnapshot,
      })),
      totalPriceCents: reservation.reservationPrestations.reduce(
        (total, line) => total + line.priceCentsSnapshot,
        0,
      ),
      ...(reservation.salon && { salon: reservation.salon }),
      ...(includeToken && { cancellationToken: reservation.cancellationToken }),
    };
  }
}
