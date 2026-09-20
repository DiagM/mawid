import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertCapability } from '../common/plans';
import { BlockClientDto } from './dto/clients-query.dto';
import { utcToLocalDate } from '../common/time/algiers-time';
import type { ClientSegment } from './dto/clients-query.dto';

/** Nombre de visites à partir duquel un client compte comme fidèle. */
const REGULAR_VISITS_THRESHOLD = 3;

/**
 * ============================================
 * Fiches clients (V3)
 * ============================================
 * La table `Client` existe depuis le lot 0, précisément pour que cette
 * fonctionnalité soit un assemblage de données déjà là plutôt qu'une
 * reconstruction a posteriori.
 *
 * Point de vue retenu : celui du **gérant**. Une fiche ne montre que ce que
 * ce salon a vécu avec ce client — jamais ses rendez-vous ailleurs, alors
 * même que le client est partagé entre salons. C'est l'isolation la plus
 * importante de ce module, et elle ne repose sur aucune colonne `salonId`
 * dans `Client` : elle est portée par les filtres de requête.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des clients déjà venus dans le salon du gérant.
   *
   * Triés par dernière visite : un gérant cherche « qui n'est pas revenu
   * depuis longtemps » bien plus souvent qu'un nom précis.
   */
  async findMine(
    userId: string,
    query?: string,
    limit = 100,
    segment: ClientSegment = 'all',
    lapsedDays = 60,
  ) {
    const salon = await this.getOwnedSalon(userId);
    assertCapability(salon.plan, 'clients');
    const search = query?.trim();

    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId: salon.id,
        ...(search && {
          OR: [
            { clientFirstName: { contains: search, mode: 'insensitive' } },
            { clientPhone: { contains: search } },
          ],
        }),
      },
      orderBy: { startsAt: 'desc' },
      select: {
        clientId: true,
        clientFirstName: true,
        clientPhone: true,
        startsAt: true,
        status: true,
        client: { select: { isBlocked: true } },
        reservationPrestations: { select: { priceCentsSnapshot: true } },
      },
    });

    interface Row {
      id: string;
      firstName: string;
      phone: string;
      isBlocked: boolean;
      visits: number;
      noShows: number;
      canceled: number;
      totalSpentCents: number;
      lastVisit: Date | null;
      nextVisit: Date | null;
    }

    const now = new Date();
    const byClient = new Map<string, Row>();

    for (const reservation of reservations) {
      const row = byClient.get(reservation.clientId) ?? {
        id: reservation.clientId,
        // Le prénom le plus récent : les réservations sont triées par date
        // décroissante, donc la première rencontrée fait foi.
        firstName: reservation.clientFirstName,
        phone: reservation.clientPhone,
        isBlocked: reservation.client.isBlocked,
        visits: 0,
        noShows: 0,
        canceled: 0,
        totalSpentCents: 0,
        lastVisit: null,
        nextVisit: null,
      };

      switch (reservation.status) {
        case 'HONORED':
          row.visits += 1;
          row.totalSpentCents += reservation.reservationPrestations.reduce(
            (total, line) => total + line.priceCentsSnapshot,
            0,
          );
          if (row.lastVisit === null) {
            row.lastVisit = reservation.startsAt;
          }
          break;
        case 'NO_SHOW':
          row.noShows += 1;
          break;
        case 'CANCELED':
          row.canceled += 1;
          break;
        case 'CONFIRMED':
          // Le prochain rendez-vous à venir : utile pour savoir qui on
          // reverra bientôt avant de décrocher son téléphone.
          if (
            reservation.startsAt.getTime() > now.getTime() &&
            (row.nextVisit === null || reservation.startsAt < row.nextVisit)
          ) {
            row.nextVisit = reservation.startsAt;
          }
          break;
      }

      byClient.set(reservation.clientId, row);
    }

    const lapsedBefore = new Date(
      now.getTime() - lapsedDays * 24 * 60 * 60 * 1000,
    );

    const matchesSegment = (row: Row): boolean => {
      switch (segment) {
        case 'lapsed':
          // Un client sans aucune visite honorée n'est pas « perdu de vue » :
          // il n'est jamais venu. Et un client avec un RDV à venir revient
          // déjà, le relancer serait à côté de la plaque.
          return (
            row.visits > 0 &&
            row.nextVisit === null &&
            row.lastVisit !== null &&
            row.lastVisit < lapsedBefore
          );
        case 'regulars':
          return row.visits >= REGULAR_VISITS_THRESHOLD;
        case 'all':
          return true;
      }
    };

    const items = [...byClient.values()]
      .filter(matchesSegment)
      .sort((a, b) => {
        // Sans visite honorée, on ne peut pas trier par dernière venue :
        // ces clients passent après ceux qu'on a déjà vus.
        const aTime = a.lastVisit?.getTime() ?? 0;
        const bTime = b.lastVisit?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        firstName: row.firstName,
        phone: row.phone,
        isBlocked: row.isBlocked,
        visits: row.visits,
        noShows: row.noShows,
        canceled: row.canceled,
        totalSpentCents: row.totalSpentCents,
        lastVisit: row.lastVisit ? utcToLocalDate(row.lastVisit) : null,
        nextVisit: row.nextVisit ? utcToLocalDate(row.nextVisit) : null,
      }));

    return { total: items.length, items };
  }

  /**
   * Historique détaillé d'un client dans CE salon.
   *
   * L'identifiant client est fourni par l'appelant : on vérifie donc qu'il a
   * bien des rendez-vous dans le salon du gérant. Sans ce contrôle, n'importe
   * quel gérant pourrait lire la fiche d'un client d'un autre salon en
   * devinant son identifiant.
   */
  async findOne(userId: string, clientId: string) {
    const salon = await this.getOwnedSalon(userId);
    assertCapability(salon.plan, 'clients');

    const reservations = await this.prisma.reservation.findMany({
      where: { salonId: salon.id, clientId },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        startsAt: true,
        status: true,
        clientFirstName: true,
        clientPhone: true,
        internalNote: true,
        employee: { select: { fullName: true } },
        reservationPrestations: {
          select: { nameSnapshot: true, priceCentsSnapshot: true },
        },
      },
    });

    if (reservations.length === 0) {
      throw new NotFoundException('Client introuvable dans votre salon');
    }

    const latest = reservations[0];

    const blocked = await this.prisma.salonBlockedClient.findUnique({
      where: { salonId_clientId: { salonId: salon.id, clientId } },
      select: { reason: true },
    });

    return {
      id: clientId,
      firstName: latest.clientFirstName,
      phone: latest.clientPhone,
      isBlockedHere: blocked !== null,
      blockReason: blocked?.reason ?? null,
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        localDate: utcToLocalDate(reservation.startsAt),
        startsAt: reservation.startsAt.toISOString(),
        status: reservation.status,
        employeeName: reservation.employee?.fullName ?? null,
        internalNote: reservation.internalNote,
        prestations: reservation.reservationPrestations.map((line) => ({
          name: line.nameSnapshot,
          priceCents: line.priceCentsSnapshot,
        })),
        totalPriceCents: reservation.reservationPrestations.reduce(
          (total, line) => total + line.priceCentsSnapshot,
          0,
        ),
      })),
    };
  }

  /**
   * Bloque ou débloque une cliente **dans ce salon**.
   *
   * Local et non global : `Client.isBlocked` bannit de toute la plateforme
   * et relève de Mawid. Un salon qui subit des lapins répétés doit pouvoir
   * refuser cette personne chez lui, sans l'exclure de tous les autres —
   * ce serait lui donner un pouvoir qui n'est pas le sien.
   *
   * La cliente doit avoir un historique dans ce salon : sans ce contrôle,
   * un gérant pourrait bloquer n'importe quel identifiant et s'en servir
   * pour deviner qui fréquente la plateforme.
   */
  async setBlocked(userId: string, clientId: string, dto: BlockClientDto) {
    const salon = await this.getOwnedSalon(userId);
    assertCapability(salon.plan, 'clients');

    const seenHere = await this.prisma.reservation.count({
      where: { salonId: salon.id, clientId },
    });

    if (seenHere === 0) {
      throw new NotFoundException('Client introuvable dans votre salon');
    }

    if (dto.isBlocked) {
      await this.prisma.salonBlockedClient.upsert({
        where: { salonId_clientId: { salonId: salon.id, clientId } },
        // Réécrit le motif : rebloquer quelqu'un est souvent l'occasion de
        // préciser pourquoi.
        update: { reason: dto.reason ?? null },
        create: { salonId: salon.id, clientId, reason: dto.reason ?? null },
      });
    } else {
      // `deleteMany` et non `delete` : débloquer quelqu'un qui ne l'était
      // pas ne doit pas échouer, l'action est idempotente.
      await this.prisma.salonBlockedClient.deleteMany({
        where: { salonId: salon.id, clientId },
      });
    }

    return { clientId, isBlockedHere: dto.isBlocked };
  }

  private async getOwnedSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true, plan: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    return salon;
  }
}
