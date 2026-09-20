import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { capabilitiesFor } from '../common/plans';
import type { SalonPlan } from '@prisma/client';
import { localDayRangeUtc, utcToLocalDate } from '../common/time/algiers-time';

/** Fenêtre d'analyse, en instants UTC. */
interface Period {
  start: Date;
  end: Date;
}

export interface StatsCounts {
  confirmed: number;
  honored: number;
  noShow: number;
  canceled: number;
  total: number;
}

export interface PeriodStats {
  revenueCents: number;
  counts: StatsCounts;
  /** Panier moyen sur les seuls rendez-vous honorés. */
  averageBasketCents: number | null;
  /**
   * Part de clients qui ne se sont pas présentés, en pourcentage.
   * Dénominateur : honorés + absents. Les annulations en sont exclues —
   * annuler à l'avance est un comportement correct qui laisse au salon le
   * temps de reprendre le créneau, le mélanger aux absences brouillerait
   * l'indicateur.
   */
  noShowRate: number | null;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tableau de bord du salon du gérant connecté.
   *
   * Le chiffre brut d'une période ne dit rien tout seul : on renvoie toujours
   * la période précédente de même durée, parce que la question utile au
   * gérant est « est-ce que ça va mieux ? », pas « combien exactement ».
   */
  async forManager(userId: string, from?: string, to?: string) {
    const salon = await this.getOwnedSalon(userId);

    const today = utcToLocalDate(new Date());
    // 30 jours par défaut : assez pour lisser les variations d'une semaine,
    // assez court pour que le chiffre reste actionnable.
    const endDate = to ?? today;
    const startDate = this.clampToPlan(
      from ?? this.shiftLocalDate(endDate, -29),
      salon.plan,
      today,
    );

    const current = this.toPeriod(startDate, endDate);
    const previous = this.previousPeriod(current);

    const [currentStats, previousStats, topPrestations, byEmployee, clients] =
      await Promise.all([
        this.statsFor(salon.id, current),
        this.statsFor(salon.id, previous),
        this.topPrestations(salon.id, current),
        this.byEmployee(salon.id, current),
        this.clientMix(salon.id, current),
      ]);

    return {
      period: { from: startDate, to: endDate },
      current: currentStats,
      previous: previousStats,
      topPrestations,
      byEmployee,
      clients,
    };
  }

  // ============================================
  // Calculs
  // ============================================

  /**
   * Ramène la date de début dans la profondeur d'historique de l'offre.
   *
   * On **tronque** plutôt que de refuser : un gérant Gratuit qui demande
   * trois mois reçoit le mois en cours, pas une erreur. Une statistique
   * partielle reste lisible ; un écran qui refuse de s'afficher ne vend
   * rien et donne l'impression d'une panne.
   *
   * Le premier jour autorisé est celui du mois en cours pour `statsMonths`
   * à 1 — « le mois en cours », et non « les 30 derniers jours », parce que
   * c'est ainsi qu'un gérant raisonne sur son chiffre.
   */
  private clampToPlan(
    startDate: string,
    plan: SalonPlan,
    today: string,
  ): string {
    const months = capabilitiesFor(plan).statsMonths;
    if (months === null) {
      return startDate;
    }

    const [year, month] = today.split('-').map(Number);
    // `months - 1` : 1 mois autorisé = le mois en cours uniquement.
    const firstAllowed = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
    const floor = firstAllowed.toISOString().slice(0, 10);

    return startDate < floor ? floor : startDate;
  }

  private async statsFor(
    salonId: string,
    period: Period,
  ): Promise<PeriodStats> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId,
        startsAt: { gte: period.start, lt: period.end },
      },
      select: {
        status: true,
        reservationPrestations: { select: { priceCentsSnapshot: true } },
      },
    });

    const counts: StatsCounts = {
      confirmed: 0,
      honored: 0,
      noShow: 0,
      canceled: 0,
      total: reservations.length,
    };

    let revenueCents = 0;

    for (const reservation of reservations) {
      switch (reservation.status) {
        case 'CONFIRMED':
          counts.confirmed += 1;
          break;
        case 'HONORED':
          counts.honored += 1;
          // Le chiffre d'affaires ne compte QUE les rendez-vous honorés :
          // un RDV confirmé n'a encore rien encaissé, un no-show rien du tout.
          // On somme les snapshots de prix, jamais les tarifs actuels, sinon
          // changer un prix réécrirait l'historique comptable.
          revenueCents += reservation.reservationPrestations.reduce(
            (total, line) => total + line.priceCentsSnapshot,
            0,
          );
          break;
        case 'NO_SHOW':
          counts.noShow += 1;
          break;
        case 'CANCELED':
          counts.canceled += 1;
          break;
      }
    }

    const showUpBase = counts.honored + counts.noShow;

    return {
      revenueCents,
      counts,
      averageBasketCents:
        counts.honored === 0 ? null : Math.round(revenueCents / counts.honored),
      noShowRate:
        showUpBase === 0
          ? null
          : Math.round((counts.noShow / showUpBase) * 1000) / 10,
    };
  }

  /**
   * Prestations les plus vendues sur la période, par chiffre d'affaires.
   *
   * On regroupe par `nameSnapshot` et non par `prestationId` : une prestation
   * archivée puis recréée sous le même nom doit rester lisible comme une
   * seule ligne pour le gérant, qui raisonne en noms, pas en identifiants.
   */
  private async topPrestations(salonId: string, period: Period) {
    const lines = await this.prisma.reservationPrestation.findMany({
      where: {
        reservation: {
          salonId,
          status: 'HONORED',
          startsAt: { gte: period.start, lt: period.end },
        },
      },
      select: { nameSnapshot: true, priceCentsSnapshot: true },
    });

    const totals = new Map<string, { count: number; revenueCents: number }>();

    for (const line of lines) {
      const entry = totals.get(line.nameSnapshot) ?? {
        count: 0,
        revenueCents: 0,
      };
      entry.count += 1;
      entry.revenueCents += line.priceCentsSnapshot;
      totals.set(line.nameSnapshot, entry);
    }

    return [...totals.entries()]
      .map(([name, entry]) => ({ name, ...entry }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);
  }

  /**
   * Répartition par membre de l'équipe.
   * Tableau vide pour un salon sans employés : afficher une ligne « non
   * assigné » n'apprendrait rien à un salon solo.
   */
  private async byEmployee(salonId: string, period: Period) {
    const employees = await this.prisma.employee.findMany({
      where: { salonId },
      select: { id: true, fullName: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (employees.length === 0) {
      return [];
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId,
        status: 'HONORED',
        employeeId: { not: null },
        startsAt: { gte: period.start, lt: period.end },
      },
      select: {
        employeeId: true,
        reservationPrestations: { select: { priceCentsSnapshot: true } },
      },
    });

    const totals = new Map<string, { count: number; revenueCents: number }>();

    for (const reservation of reservations) {
      if (reservation.employeeId === null) {
        continue;
      }
      const entry = totals.get(reservation.employeeId) ?? {
        count: 0,
        revenueCents: 0,
      };
      entry.count += 1;
      entry.revenueCents += reservation.reservationPrestations.reduce(
        (total, line) => total + line.priceCentsSnapshot,
        0,
      );
      totals.set(reservation.employeeId, entry);
    }

    return employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      ...(totals.get(employee.id) ?? { count: 0, revenueCents: 0 }),
    }));
  }

  /**
   * Nouveaux clients contre clients fidèles sur la période.
   *
   * « Nouveau » = aucun rendez-vous dans CE salon avant le début de la
   * période. Un client connu d'un autre salon reste un nouveau client ici :
   * c'est le point de vue du gérant qui compte.
   */
  private async clientMix(salonId: string, period: Period) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        salonId,
        status: 'HONORED',
        startsAt: { gte: period.start, lt: period.end },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const clientIds = reservations.map((reservation) => reservation.clientId);

    if (clientIds.length === 0) {
      return { total: 0, returning: 0, new: 0 };
    }

    const returningRows = await this.prisma.reservation.findMany({
      where: {
        salonId,
        clientId: { in: clientIds },
        startsAt: { lt: period.start },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const returning = returningRows.length;

    return {
      total: clientIds.length,
      returning,
      new: clientIds.length - returning,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private toPeriod(from: string, to: string): Period {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException('Dates attendues au format YYYY-MM-DD');
    }

    const { start } = localDayRangeUtc(from);
    const { end } = localDayRangeUtc(to);

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début',
      );
    }

    return { start, end };
  }

  /** Même durée, juste avant : c'est ce qui rend la comparaison honnête. */
  private previousPeriod(period: Period): Period {
    const duration = period.end.getTime() - period.start.getTime();
    return {
      start: new Date(period.start.getTime() - duration),
      end: period.start,
    };
  }

  private shiftLocalDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day));
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
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
