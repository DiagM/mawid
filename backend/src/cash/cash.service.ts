import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  localDayRangeUtc,
  utcToLocalDate,
  utcToLocalTime,
} from '../common/time/algiers-time';
import type { CreateCashMovementDto } from './dto/cash-movement.dto';

/**
 * ============================================
 * Caisse (V4)
 * ============================================
 * Un salon encaisse aussi des clients **sans rendez-vous en ligne**. Ne
 * compter que les réservations Mawid donnerait au gérant un chiffre
 * systématiquement faux — donc inutilisable, et il continuerait de tenir son
 * vrai cahier à côté.
 *
 * Ce module est donc le seul du produit à accepter des montants saisis à la
 * main, sans passer par une réservation. D'où deux précautions : les montants
 * sont toujours positifs (c'est le type qui porte le sens) et un rendez-vous
 * ne peut être encaissé qu'une fois.
 */
@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Journal de caisse d'une journée locale, avec son total.
   *
   * Une journée et non un mois : la caisse se ferme le soir, c'est le geste
   * que le gérant reproduit.
   */
  async findDay(userId: string, date?: string) {
    const salon = await this.getOwnedSalon(userId);
    const day = date ?? utcToLocalDate(new Date());
    const { start, end } = localDayRangeUtc(day);

    const movements = await this.prisma.cashMovement.findMany({
      where: { salonId: salon.id, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: 'asc' },
      select: {
        id: true,
        type: true,
        amountCents: true,
        label: true,
        method: true,
        occurredAt: true,
        employee: { select: { fullName: true } },
        reservation: { select: { clientFirstName: true } },
      },
    });

    let salesCents = 0;
    let expensesCents = 0;

    for (const movement of movements) {
      if (movement.type === 'SALE') {
        salesCents += movement.amountCents;
      } else {
        expensesCents += movement.amountCents;
      }
    }

    return {
      date: day,
      salesCents,
      expensesCents,
      // Le solde peut être négatif : une journée de gros achats sans vente
      // est une information, pas une anomalie à masquer.
      balanceCents: salesCents - expensesCents,
      items: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amountCents: movement.amountCents,
        label: movement.label,
        method: movement.method,
        localTime: utcToLocalTime(movement.occurredAt),
        employeeName: movement.employee?.fullName ?? null,
        clientFirstName: movement.reservation?.clientFirstName ?? null,
      })),
    };
  }

  /**
   * Rendez-vous honorés du jour pas encore encaissés.
   *
   * C'est ce qui évite la double saisie : le gérant clôt sa journée en
   * encaissant en un clic ce que Mawid connaît déjà, et ne saisit à la main
   * que les clients de passage.
   */
  async pendingReservations(userId: string, date?: string) {
    const salon = await this.getOwnedSalon(userId);
    const day = date ?? utcToLocalDate(new Date());
    const { start, end } = localDayRangeUtc(day);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId: salon.id,
        status: 'HONORED',
        startsAt: { gte: start, lt: end },
        // Pas encore encaissé : la relation est absente.
        cashMovement: { is: null },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        clientFirstName: true,
        employeeId: true,
        employee: { select: { fullName: true } },
        reservationPrestations: {
          select: { nameSnapshot: true, priceCentsSnapshot: true },
        },
      },
    });

    return reservations.map((reservation) => ({
      id: reservation.id,
      localTime: utcToLocalTime(reservation.startsAt),
      clientFirstName: reservation.clientFirstName,
      employeeId: reservation.employeeId,
      employeeName: reservation.employee?.fullName ?? null,
      label: reservation.reservationPrestations
        .map((line) => line.nameSnapshot)
        .join(' + '),
      amountCents: reservation.reservationPrestations.reduce(
        (total, line) => total + line.priceCentsSnapshot,
        0,
      ),
    }));
  }

  async create(userId: string, dto: CreateCashMovementDto) {
    const salon = await this.getOwnedSalon(userId);

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Date invalide');
    }

    // Un rendez-vous fourni doit appartenir au salon du gérant ET ne pas
    // avoir déjà été encaissé. Sans ce contrôle, un identifiant deviné
    // permettrait d'attacher un encaissement au rendez-vous d'un autre salon.
    if (dto.reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: dto.reservationId },
        select: {
          salonId: true,
          cashMovement: { select: { id: true } },
        },
      });

      if (!reservation || reservation.salonId !== salon.id) {
        throw new NotFoundException('Rendez-vous introuvable');
      }

      if (reservation.cashMovement) {
        throw new ConflictException('Ce rendez-vous a déjà été encaissé');
      }
    }

    if (dto.employeeId) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { salonId: true },
      });

      if (!employee || employee.salonId !== salon.id) {
        throw new NotFoundException('Membre introuvable');
      }
    }

    return this.prisma.cashMovement.create({
      data: {
        salonId: salon.id,
        type: dto.type,
        amountCents: dto.amountCents,
        label: dto.label,
        method: dto.method ?? 'CASH',
        reservationId: dto.reservationId,
        employeeId: dto.employeeId,
        occurredAt,
      },
      select: { id: true, type: true, amountCents: true, label: true },
    });
  }

  /**
   * Suppression d'un mouvement.
   *
   * Une caisse se corrige : une erreur de saisie doit pouvoir être annulée le
   * jour même. On supprime réellement plutôt que d'archiver — un journal de
   * caisse qui garde les lignes fausses n'est plus un journal de caisse.
   */
  async remove(userId: string, movementId: string) {
    const salon = await this.getOwnedSalon(userId);

    const movement = await this.prisma.cashMovement.findUnique({
      where: { id: movementId },
      select: { id: true, salonId: true },
    });

    if (!movement) {
      throw new NotFoundException('Mouvement introuvable');
    }

    if (movement.salonId !== salon.id) {
      throw new ForbiddenException("Vous n'avez pas accès à ce mouvement");
    }

    await this.prisma.cashMovement.delete({ where: { id: movement.id } });
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
