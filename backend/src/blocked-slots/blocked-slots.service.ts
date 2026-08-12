import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import {
  addCalendarDays,
  algiersPartsToUtc,
  CalendarDateParts,
  parseDateOnly,
} from '../common/algiers-time.util';

@Injectable()
export class BlockedSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un blocage pour le salon du gérant connecté.
   */
  async create(userId: string, dto: CreateBlockedSlotDto) {
    const salon = await this.getOwnedSalon(userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt doit être postérieur à startsAt');
    }

    return this.prisma.blockedSlot.create({
      data: {
        salonId: salon.id,
        startsAt,
        endsAt,
        reason: dto.reason,
      },
    });
  }

  /**
   * Supprime un blocage. Vérifie que le blocage appartient bien au salon
   * du gérant connecté.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwnership(userId, id);
    await this.prisma.blockedSlot.delete({ where: { id } });
  }

  /**
   * Liste les blocages du salon du gérant connecté.
   * `dateStr` optionnel (YYYY-MM-DD, filtre sur cette journée Alger) ;
   * sinon renvoie tous les blocages à venir.
   */
  async findMine(userId: string, dateStr?: string) {
    const salon = await this.getOwnedSalon(userId);

    if (!dateStr) {
      return this.prisma.blockedSlot.findMany({
        where: { salonId: salon.id, endsAt: { gt: new Date() } },
        orderBy: { startsAt: 'asc' },
      });
    }

    let dateParts: CalendarDateParts;
    try {
      dateParts = parseDateOnly(dateStr);
    } catch {
      throw new BadRequestException(
        'Format de date invalide (attendu YYYY-MM-DD)',
      );
    }

    const dayStartUtc = algiersPartsToUtc({ ...dateParts, hour: 0, minute: 0 });
    const dayEndUtc = algiersPartsToUtc({
      ...addCalendarDays(dateParts, 1),
      hour: 0,
      minute: 0,
    });

    return this.prisma.blockedSlot.findMany({
      where: {
        salonId: salon.id,
        startsAt: { lt: dayEndUtc },
        endsAt: { gt: dayStartUtc },
      },
      orderBy: { startsAt: 'asc' },
    });
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

  private async assertOwnership(userId: string, id: string): Promise<void> {
    const blockedSlot = await this.prisma.blockedSlot.findUnique({
      where: { id },
      select: { salon: { select: { ownerId: true } } },
    });

    if (!blockedSlot) {
      throw new NotFoundException('Blocage introuvable');
    }

    if (blockedSlot.salon.ownerId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce blocage");
    }
  }
}
