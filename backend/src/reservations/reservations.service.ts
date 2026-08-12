import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Prestation,
  Reservation,
  ReservationPrestation,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import {
  addCalendarDays,
  algiersPartsToUtc,
  CalendarDateParts,
  formatAlgiersDate,
  formatAlgiersTime,
  getAlgiersWeekday,
  parseDateOnly,
  parseTimeOnly,
  generateSlots,
  utcToAlgiersParts,
  Weekday,
} from '../common/algiers-time.util';

type OpeningHoursMap = Partial<
  Record<Weekday, { open: string; close: string } | null>
>;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================
  // Routes publiques
  // ============================================

  /**
   * Calcule les créneaux disponibles pour une combinaison de prestations,
   * sur les prochains `days` jours calendaires (heure d'Alger).
   */
  async getAvailability(slug: string, query: AvailabilityQueryDto) {
    const salon = await this.resolvePublicSalon(slug);

    const rawIds = query.prestationIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const ids = Array.from(new Set(rawIds));

    if (ids.length === 0) {
      throw new BadRequestException('prestationIds est requis');
    }

    const prestations = await this.resolveActivePrestations(salon.id, ids);
    const totalDurationMinutes = prestations.reduce(
      (sum, p) => sum + p.durationMinutes,
      0,
    );

    const days = query.days ?? 7;
    const now = new Date();
    const todayParts = utcToAlgiersParts(now);
    const openingHours = salon.openingHours as unknown as OpeningHoursMap;

    // On récupère en une seule passe tout ce qui pourrait chevaucher un
    // créneau, sur toute la fenêtre demandée (lecture seule : pas de risque
    // de course ici, contrairement à la création de réservation).
    const windowEndParts = addCalendarDays(todayParts, days);
    const windowEnd = algiersPartsToUtc({
      ...windowEndParts,
      hour: 0,
      minute: 0,
    });

    const [busyReservations, busyBlockedSlots] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          salonId: salon.id,
          status: 'CONFIRMED',
          startsAt: { lt: windowEnd },
          endsAt: { gt: now },
        },
        select: { startsAt: true, endsAt: true },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          salonId: salon.id,
          startsAt: { lt: windowEnd },
          endsAt: { gt: now },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const busyRanges = [...busyReservations, ...busyBlockedSlots];
    const isOverlapping = (slotStart: Date, slotEnd: Date) =>
      busyRanges.some(
        (busy) => busy.startsAt < slotEnd && busy.endsAt > slotStart,
      );

    const result: Array<{ date: string; slots: string[] }> = [];

    for (let i = 0; i < days; i++) {
      const dateParts = addCalendarDays(todayParts, i);
      const dayStartUtc = algiersPartsToUtc({
        ...dateParts,
        hour: 0,
        minute: 0,
      });
      const weekday = getAlgiersWeekday(dayStartUtc);
      const dateLabel = formatAlgiersDate(dayStartUtc);
      const dayHours = openingHours?.[weekday];

      if (!dayHours) {
        result.push({ date: dateLabel, slots: [] });
        continue;
      }

      const openParts = parseTimeOnly(dayHours.open);
      const closeParts = parseTimeOnly(dayHours.close);
      const openUtc = algiersPartsToUtc({ ...dateParts, ...openParts });
      const closeUtc = algiersPartsToUtc({ ...dateParts, ...closeParts });

      const slots = generateSlots(openUtc, closeUtc, 30)
        .filter(
          (slot) =>
            slot.getTime() + totalDurationMinutes * 60_000 <=
            closeUtc.getTime(),
        )
        .filter((slot) => slot.getTime() >= now.getTime())
        .filter((slot) => {
          const slotEnd = new Date(
            slot.getTime() + totalDurationMinutes * 60_000,
          );
          return !isOverlapping(slot, slotEnd);
        })
        .map((slot) => formatAlgiersTime(slot));

      result.push({ date: dateLabel, slots });
    }

    return result;
  }

  /**
   * Crée une réservation cliente (aucune authentification requise).
   * Protégé contre le double-booking par une transaction Serializable :
   * si deux clients réservent le même créneau en même temps, l'un des deux
   * essuie un ConflictException plutôt qu'une réservation en doublon.
   */
  async create(slug: string, dto: CreateReservationDto) {
    const salon = await this.resolvePublicSalon(slug);

    const uniqueIds = Array.from(new Set(dto.prestationIds));
    if (uniqueIds.length !== dto.prestationIds.length) {
      throw new BadRequestException(
        'La liste de prestations contient des doublons',
      );
    }

    const prestations = await this.resolveActivePrestations(
      salon.id,
      uniqueIds,
    );
    const prestationById = new Map(prestations.map((p) => [p.id, p]));

    const totalDurationMinutes = dto.prestationIds.reduce(
      (sum, id) => sum + prestationById.get(id)!.durationMinutes,
      0,
    );
    const totalPriceCents = dto.prestationIds.reduce(
      (sum, id) => sum + prestationById.get(id)!.priceCents,
      0,
    );

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(startsAt.getTime() + totalDurationMinutes * 60_000);

    let created: Reservation & {
      reservationPrestations: ReservationPrestation[];
    };

    try {
      created = await this.prisma.$transaction(
        async (tx) => {
          const conflictingReservation = await tx.reservation.findFirst({
            where: {
              salonId: salon.id,
              status: 'CONFIRMED',
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });

          const conflictingBlockedSlot = await tx.blockedSlot.findFirst({
            where: {
              salonId: salon.id,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });

          if (conflictingReservation || conflictingBlockedSlot) {
            throw new ConflictException(
              "Ce créneau vient d'être réservé, merci d'en choisir un autre.",
            );
          }

          return tx.reservation.create({
            data: {
              salonId: salon.id,
              startsAt,
              endsAt,
              clientFirstName: dto.clientFirstName,
              clientPhone: dto.clientPhone,
              status: 'CONFIRMED',
              reservationPrestations: {
                create: dto.prestationIds.map((id) => {
                  const prestation = prestationById.get(id)!;
                  return {
                    prestationId: id,
                    nameSnapshot: prestation.name,
                    priceCentsSnapshot: prestation.priceCents,
                    durationMinutesSnapshot: prestation.durationMinutes,
                  };
                }),
              },
            },
            include: { reservationPrestations: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (this.isSerializationConflict(error)) {
        throw new ConflictException(
          "Ce créneau vient d'être réservé, merci d'en choisir un autre.",
        );
      }
      throw error;
    }

    const whatsappConfirmationUrl =
      await this.notificationsService.buildConfirmationLink({
        clientFirstName: created.clientFirstName,
        clientPhone: created.clientPhone,
        startsAt: created.startsAt,
        cancellationToken: created.cancellationToken,
        salonName: salon.name,
        prestationNames: dto.prestationIds.map(
          (id) => prestationById.get(id)!.name,
        ),
        totalPriceCents,
      });

    return {
      ...this.mapReservation(created),
      whatsappConfirmationUrl,
    };
  }

  /**
   * Consultation publique d'une réservation via son token d'annulation.
   */
  async findByToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancellationToken: token },
      include: {
        reservationPrestations: true,
        salon: { select: { name: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    return {
      ...this.mapReservation(reservation),
      salonName: reservation.salon.name,
    };
  }

  /**
   * Annulation publique par le client via son token.
   */
  async cancelByToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancellationToken: token },
      include: {
        reservationPrestations: true,
        salon: { select: { name: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictException(
        'Cette réservation ne peut plus être annulée.',
      );
    }

    if (reservation.startsAt.getTime() <= Date.now()) {
      throw new ConflictException(
        'Cette réservation est déjà passée, elle ne peut plus être annulée.',
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELED' },
      include: {
        reservationPrestations: true,
        salon: { select: { name: true } },
      },
    });

    return {
      ...this.mapReservation(updated),
      salonName: updated.salon.name,
    };
  }

  // ============================================
  // Routes protégées (gérant connecté)
  // ============================================

  /**
   * Agenda d'une journée (réservations + blocages) pour le salon du gérant
   * connecté. `dateStr` optionnel (YYYY-MM-DD), défaut = aujourd'hui (Alger).
   */
  async findMyDay(userId: string, dateStr?: string) {
    const salon = await this.getOwnedSalon(userId);

    let dateParts: CalendarDateParts;
    if (dateStr) {
      try {
        dateParts = parseDateOnly(dateStr);
      } catch {
        throw new BadRequestException(
          'Format de date invalide (attendu YYYY-MM-DD)',
        );
      }
    } else {
      dateParts = utcToAlgiersParts(new Date());
    }

    const dayStartUtc = algiersPartsToUtc({ ...dateParts, hour: 0, minute: 0 });
    const dayEndUtc = algiersPartsToUtc({
      ...addCalendarDays(dateParts, 1),
      hour: 0,
      minute: 0,
    });

    const [reservations, blockedSlots] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          salonId: salon.id,
          startsAt: { gte: dayStartUtc, lt: dayEndUtc },
        },
        orderBy: { startsAt: 'asc' },
        include: { reservationPrestations: true },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          salonId: salon.id,
          startsAt: { lt: dayEndUtc },
          endsAt: { gt: dayStartUtc },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    return {
      reservations: reservations.map((r) => this.mapReservation(r)),
      blockedSlots: blockedSlots.map((b) => ({
        id: b.id,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        reason: b.reason,
      })),
    };
  }

  /**
   * Marque une réservation confirmée comme honorée ou non honorée.
   * Uniquement possible depuis le statut CONFIRMED (l'annulation passe par
   * la route publique dédiée /token/:token/cancel).
   */
  async updateStatus(
    userId: string,
    reservationId: string,
    dto: UpdateReservationStatusDto,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        salon: { select: { ownerId: true } },
        reservationPrestations: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (reservation.salon.ownerId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette réservation");
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new ConflictException(
        'Seule une réservation confirmée peut être mise à jour.',
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { status: dto.status },
      include: { reservationPrestations: true },
    });

    return this.mapReservation(updated);
  }

  // ============================================
  // Helpers privés
  // ============================================

  /**
   * Résout un salon pour affichage/réservation publique.
   * 404 si inexistant ou désactivé.
   */
  private async resolvePublicSalon(slug: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        isActive: true,
        openingHours: true,
      },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon introuvable');
    }

    return salon;
  }

  /**
   * Résout une liste d'IDs de prestations, en vérifiant qu'elles
   * appartiennent bien au salon et sont actives. 400 si un ID ne résout pas.
   */
  private async resolveActivePrestations(
    salonId: string,
    ids: string[],
  ): Promise<Prestation[]> {
    const prestations = await this.prisma.prestation.findMany({
      where: { id: { in: ids }, salonId, isActive: true },
    });

    if (prestations.length !== ids.length) {
      throw new BadRequestException(
        'Une ou plusieurs prestations sont invalides ou inactives',
      );
    }

    return prestations;
  }

  /**
   * Récupère le salon du gérant connecté ou lève une exception.
   */
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
   * Détecte une erreur de conflit de sérialisation Postgres (code Prisma
   * P2034), levée quand deux transactions Serializable concurrentes se
   * chevauchent. C'est ce qui rend le double-booking impossible même en cas
   * de course entre deux requêtes simultanées sur le même créneau.
   */
  private isSerializationConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2034'
    );
  }

  /**
   * Reformate une réservation Prisma (avec ses prestations) en shape public,
   * commune à toutes les routes de ce service.
   */
  private mapReservation(
    reservation: Reservation & {
      reservationPrestations: ReservationPrestation[];
    },
  ) {
    const prestations = reservation.reservationPrestations.map((rp) => ({
      prestationId: rp.prestationId,
      name: rp.nameSnapshot,
      priceCents: rp.priceCentsSnapshot,
      durationMinutes: rp.durationMinutesSnapshot,
    }));

    return {
      id: reservation.id,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      status: reservation.status,
      clientFirstName: reservation.clientFirstName,
      clientPhone: reservation.clientPhone,
      cancellationToken: reservation.cancellationToken,
      prestations,
      totalPriceCents: prestations.reduce((sum, p) => sum + p.priceCents, 0),
      totalDurationMinutes: prestations.reduce(
        (sum, p) => sum + p.durationMinutes,
        0,
      ),
    };
  }
}
