import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../reservations/availability.service';
import {
  JoinWaitlistDto,
  MarkNotifiedDto,
  WaitlistQueryDto,
} from './dto/waitlist.dto';
import { utcToLocalDate } from '../common/time/algiers-time';

/**
 * Demandes en attente qu'un même numéro peut détenir dans un salon.
 *
 * Trois suffit largement à une cliente qui hésite entre plusieurs jours, et
 * empêche d'inonder la liste du gérant — qui la lit à la main.
 */
const MAX_WAITING_PER_CLIENT = 3;

/**
 * ============================================
 * Liste d'attente
 * ============================================
 * Quand un jour est complet, la cliente repartait sans laisser de trace :
 * du chiffre d'affaires perdu pour le salon, un client perdu pour la
 * plateforme.
 *
 * **Aucune notification automatique.** Envoyer un SMS ou un WhatsApp se
 * facture au message. C'est le gérant qui contacte, depuis son agenda, avec
 * un lien préparé — gratuitement, et depuis son propre numéro, ce qui donne
 * au message une chance d'être lu.
 */
@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  // ============================================
  // Côté cliente (public)
  // ============================================

  /**
   * Inscrit une cliente sur la liste d'attente d'une journée.
   *
   * La journée doit être **réellement complète pour cette demande**. Sans ce
   * contrôle, la liste d'attente deviendrait un second canal de réservation :
   * on y inscrirait des gens alors que des créneaux sont libres, et le gérant
   * passerait ses journées à rappeler des clientes qui auraient pu réserver
   * seules.
   */
  async join(slug: string, dto: JoinWaitlistDto) {
    const context = await this.availability.resolveContext(
      slug,
      dto.prestationIds,
    );

    const client = await this.prisma.client.upsert({
      where: { phone: dto.clientPhone },
      update: { firstName: dto.clientFirstName },
      create: { phone: dto.clientPhone, firstName: dto.clientFirstName },
      select: { id: true, isBlocked: true },
    });

    // Le blocage est vérifié AVANT la disponibilité : sinon une personne
    // bloquée apprendrait, par la différence de message, si la journée est
    // complète — une information que le salon lui refuse par ailleurs.
    await this.assertNotBlocked(client, context.salonId);
    await this.assertWithinQuota(client.id, context.salonId);

    const availability = await this.availability.getAvailability(
      slug,
      dto.desiredDate,
      dto.prestationIds,
    );

    if (availability.slots.length > 0) {
      throw new BadRequestException(
        'Des créneaux sont encore libres ce jour-là. Réservez directement.',
      );
    }

    const entry = await this.prisma.waitlistEntry.upsert({
      // Rafraîchir la page ne doit pas créer un doublon que le gérant
      // devrait démêler.
      where: {
        salonId_clientId_desiredDate: {
          salonId: context.salonId,
          clientId: client.id,
          desiredDate: dto.desiredDate,
        },
      },
      update: {
        prestationsSummary: summarize(context.prestations),
        durationMinutes: context.totalDurationMinutes,
        note: dto.note ?? null,
        // Une nouvelle demande annule le fait d'avoir déjà été contactée.
        notifiedAt: null,
      },
      create: {
        salonId: context.salonId,
        clientId: client.id,
        desiredDate: dto.desiredDate,
        clientFirstName: dto.clientFirstName,
        clientPhone: dto.clientPhone,
        prestationsSummary: summarize(context.prestations),
        durationMinutes: context.totalDurationMinutes,
        note: dto.note ?? null,
      },
      select: { id: true, desiredDate: true, createdAt: true },
    });

    return {
      id: entry.id,
      desiredDate: entry.desiredDate,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  // ============================================
  // Côté gérant (protégé)
  // ============================================

  /**
   * Demandes en attente du salon, du jour dit vers le futur.
   *
   * Les jours passés sont exclus : une demande pour hier n'appelle plus
   * aucune action et n'encombre que la liste.
   */
  async findMine(userId: string, query: WaitlistQueryDto) {
    const salon = await this.getOwnedSalon(userId);
    const today = utcToLocalDate(new Date());

    const from = query.from ?? today;
    const to = query.to ?? shiftLocalDate(from, 30);

    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        salonId: salon.id,
        desiredDate: { gte: from, lte: to },
      },
      // Par jour puis par ordre d'arrivée : le premier inscrit est le
      // premier à rappeler, c'est la seule règle équitable.
      orderBy: [{ desiredDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        desiredDate: true,
        clientFirstName: true,
        clientPhone: true,
        prestationsSummary: true,
        durationMinutes: true,
        note: true,
        notifiedAt: true,
        createdAt: true,
      },
    });

    return entries.map((entry) => ({
      ...entry,
      notifiedAt: entry.notifiedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  /** Marque une demande comme traitée, ou revient en arrière. */
  async setNotified(userId: string, entryId: string, dto: MarkNotifiedDto) {
    const entry = await this.assertOwnership(userId, entryId);

    return this.prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { notifiedAt: dto.notified ? new Date() : null },
      select: { id: true, notifiedAt: true },
    });
  }

  /** Retire une demande de la liste. */
  async remove(userId: string, entryId: string) {
    const entry = await this.assertOwnership(userId, entryId);

    await this.prisma.waitlistEntry.delete({ where: { id: entry.id } });
  }

  // ============================================
  // Helpers privés
  // ============================================

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

    // Même message neutre que le refus de réservation : la liste d'attente
    // ne doit pas devenir l'oracle qui révèle un blocage.
    throw new ForbiddenException(
      'Inscription impossible. Contactez directement le salon.',
    );
  }

  private async assertWithinQuota(clientId: string, salonId: string) {
    const today = utcToLocalDate(new Date());

    const waiting = await this.prisma.waitlistEntry.count({
      where: { salonId, clientId, desiredDate: { gte: today } },
    });

    if (waiting >= MAX_WAITING_PER_CLIENT) {
      throw new ForbiddenException(
        `Vous êtes déjà sur ${waiting} listes d'attente dans ce salon.`,
      );
    }
  }

  private async assertOwnership(userId: string, entryId: string) {
    const salon = await this.getOwnedSalon(userId);

    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id: entryId },
      select: { id: true, salonId: true },
    });

    if (!entry) {
      throw new NotFoundException('Demande introuvable');
    }

    if (entry.salonId !== salon.id) {
      throw new ForbiddenException("Vous n'avez pas accès à cette demande");
    }

    return entry;
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
}

/** « Coupe + Barbe », tel que le gérant le lira dans sa liste. */
function summarize(prestations: { name: string }[]): string {
  return prestations.map((prestation) => prestation.name).join(' + ');
}

/** Décale une date locale `YYYY-MM-DD` d'un nombre de jours. */
function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}
