import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import {
  localDayRangeUtc,
  utcToLocalDate,
  utcToLocalTime,
} from '../common/time/algiers-time';

/** Durée maximale d'un blocage : au-delà, c'est une fermeture, pas une pause. */
const MAX_BLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BlockedSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créneaux bloqués du salon du gérant connecté.
   * Sans bornes : les 30 jours à venir, ce qui correspond à ce qu'un gérant
   * regarde en pratique.
   */
  async findMine(userId: string, from?: string, to?: string) {
    const salon = await this.getOwnedSalon(userId);

    const today = utcToLocalDate(new Date());
    const { start } = localDayRangeUtc(from ?? today);
    const end = to
      ? localDayRangeUtc(to).end
      : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    const slots = await this.prisma.blockedSlot.findMany({
      where: {
        salonId: salon.id,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      orderBy: { startsAt: 'asc' },
    });

    return slots.map((slot) => this.toView(slot));
  }

  async create(userId: string, dto: CreateBlockedSlotDto) {
    const salon = await this.getOwnedSalon(userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Dates invalides');
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('La fin doit être postérieure au début');
    }

    if (endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_DURATION_MS) {
      throw new BadRequestException(
        'Un créneau bloqué ne peut pas dépasser 30 jours',
      );
    }

    // Bloquer un créneau déjà réservé laisserait le client avec un RDV que le
    // salon considère comme indisponible. On refuse, à charge pour le gérant
    // d'annuler explicitement le RDV d'abord — c'est une décision qui doit
    // rester consciente.
    const conflicting = await this.prisma.reservation.count({
      where: {
        salonId: salon.id,
        status: 'CONFIRMED',
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (conflicting > 0) {
      throw new BadRequestException(
        `${conflicting} rendez-vous confirmé(s) occupent déjà cette période. ` +
          'Annulez-les avant de bloquer le créneau.',
      );
    }

    const slot = await this.prisma.blockedSlot.create({
      data: {
        salonId: salon.id,
        startsAt,
        endsAt,
        reason: dto.reason,
      },
    });

    return this.toView(slot);
  }

  async remove(userId: string, blockedSlotId: string) {
    const salon = await this.getOwnedSalon(userId);

    const slot = await this.prisma.blockedSlot.findUnique({
      where: { id: blockedSlotId },
      select: { id: true, salonId: true },
    });

    if (!slot) {
      throw new NotFoundException('Créneau bloqué introuvable');
    }

    if (slot.salonId !== salon.id) {
      throw new ForbiddenException("Vous n'avez pas accès à ce créneau");
    }

    await this.prisma.blockedSlot.delete({ where: { id: slot.id } });
  }

  // ============================================
  // Helpers privés
  // ============================================

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

  private toView(slot: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }) {
    return {
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      localDate: utcToLocalDate(slot.startsAt),
      localStartTime: utcToLocalTime(slot.startsAt),
      localEndTime: utcToLocalTime(slot.endsAt),
      reason: slot.reason,
    };
  }
}
