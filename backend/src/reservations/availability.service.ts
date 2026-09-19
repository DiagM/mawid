import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getBookingRules } from './booking-rules';
import {
  addMinutes,
  localDayRangeUtc,
  localToUtc,
  utcToLocalDate,
  utcToLocalTime,
  weekdayOfLocalDate,
  type WeekdayKey,
} from '../common/time/algiers-time';

/**
 * Plage horaire d'ouverture d'un jour, telle que stockée dans
 * `Salon.openingHours` (Json non typé côté base).
 */
interface DayHours {
  open: string;
  close: string;
}

/** Intervalle occupé par une ressource. */
interface BusyInterval {
  start: Date;
  end: Date;
  /** null = concerne toutes les ressources du salon. */
  employeeId: string | null;
}

/**
 * Ressource capable d'exécuter une prestation.
 * En V1 il en existe exactement une par salon, avec `id: null` — le gérant.
 * Le moteur raisonne malgré tout sur une liste, parce que rétrofiter cette
 * notion en V2 reviendrait à le réécrire entièrement.
 */
interface Resource {
  id: string | null;
  workingHours: Record<string, DayHours | null> | null;
}

export interface AvailableSlot {
  /** Début du créneau, ISO UTC — la seule valeur à renvoyer au serveur. */
  startsAt: string;
  /** Heure locale `HH:mm`, pour que le front n'ait aucune conversion à faire. */
  localTime: string;
}

export interface AvailabilityResult {
  date: string;
  totalDurationMinutes: number;
  slots: AvailableSlot[];
}

/** Salon résolu + prestations validées, réutilisé par le service d'écriture. */
export interface ResolvedBookingContext {
  salonId: string;
  openingHours: Record<string, DayHours | null>;
  prestations: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
  }[];
  totalDurationMinutes: number;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout un salon public et valide une sélection de prestations.
   *
   * Centralisé ici parce que la lecture (calcul des créneaux) et l'écriture
   * (création de réservation) doivent appliquer **exactement** les mêmes
   * règles : un créneau affiché comme libre n'a aucune valeur s'il n'est pas
   * revalidé au moment de l'insertion.
   */
  async resolveContext(
    slug: string,
    prestationIds: string[],
  ): Promise<ResolvedBookingContext> {
    const rules = getBookingRules();

    if (prestationIds.length === 0) {
      throw new BadRequestException('Au moins une prestation est requise');
    }

    const uniqueIds = [...new Set(prestationIds)];
    if (uniqueIds.length !== prestationIds.length) {
      throw new BadRequestException(
        'Une même prestation ne peut pas être sélectionnée deux fois',
      );
    }

    if (uniqueIds.length > rules.maxPrestationsPerReservation) {
      throw new BadRequestException(
        `Maximum ${rules.maxPrestationsPerReservation} prestations par réservation`,
      );
    }

    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true, openingHours: true },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon introuvable');
    }

    const prestations = await this.prisma.prestation.findMany({
      where: { id: { in: uniqueIds }, salonId: salon.id, isActive: true },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        priceCents: true,
      },
    });

    // Filtrer sur salonId ci-dessus ne suffit pas : il faut vérifier que TOUTES
    // les prestations demandées ont été retrouvées, sinon un id appartenant à
    // un autre salon serait silencieusement ignoré au lieu d'être refusé.
    if (prestations.length !== uniqueIds.length) {
      throw new NotFoundException(
        'Prestation introuvable ou indisponible pour ce salon',
      );
    }

    const totalDurationMinutes = prestations.reduce(
      (total, prestation) => total + prestation.durationMinutes,
      0,
    );

    if (totalDurationMinutes > rules.maxTotalDurationMinutes) {
      throw new BadRequestException(
        `La durée totale ne peut pas dépasser ${rules.maxTotalDurationMinutes} minutes`,
      );
    }

    return {
      salonId: salon.id,
      openingHours: this.parseOpeningHours(salon.openingHours),
      prestations,
      totalDurationMinutes,
    };
  }

  /**
   * Créneaux réservables pour un jour local donné.
   * Un créneau est proposé dès qu'au moins une ressource est libre sur toute
   * sa durée.
   */
  async getAvailability(
    slug: string,
    date: string,
    prestationIds: string[],
    now: Date = new Date(),
    employeeId?: string,
  ): Promise<AvailabilityResult> {
    const context = await this.resolveContext(slug, prestationIds);
    this.assertDateWithinHorizon(date, now);

    const slots = await this.computeSlots(
      context.salonId,
      context.openingHours,
      date,
      context.totalDurationMinutes,
      now,
      employeeId,
    );

    return {
      date,
      totalDurationMinutes: context.totalDurationMinutes,
      slots: slots.map((start) => ({
        startsAt: start.toISOString(),
        localTime: utcToLocalTime(start),
      })),
    };
  }

  /**
   * Vérifie qu'un créneau précis est réservable et désigne la ressource qui
   * l'exécutera. Appelé juste avant l'insertion — c'est le garde-fou contre un
   * client qui posterait un `startsAt` fabriqué à la main.
   *
   * @returns l'`employeeId` retenu (`null` = ressource unique du salon)
   */
  async resolveResourceForSlot(
    context: ResolvedBookingContext,
    startsAt: Date,
    now: Date = new Date(),
    employeeId?: string,
  ): Promise<string | null> {
    const date = utcToLocalDate(startsAt);
    this.assertDateWithinHorizon(date, now);

    const endsAt = addMinutes(startsAt, context.totalDurationMinutes);
    const rules = getBookingRules();

    if (startsAt.getTime() < now.getTime() + rules.minLeadMinutes * 60_000) {
      throw new BadRequestException(
        `Une réservation doit être prise au moins ${rules.minLeadMinutes} minutes à l'avance`,
      );
    }

    const window = this.openingWindow(context.openingHours, date);
    if (!window) {
      throw new BadRequestException('Le salon est fermé ce jour-là');
    }

    if (
      startsAt.getTime() < window.open.getTime() ||
      endsAt.getTime() > window.close.getTime()
    ) {
      throw new BadRequestException(
        "Le créneau demandé sort des horaires d'ouverture",
      );
    }

    // On refuse un début qui ne tombe pas sur la grille : sans ça, un client
    // pourrait grignoter des créneaux décalés de quelques minutes et rendre
    // l'agenda du salon inexploitable.
    const minutesFromOpen =
      (startsAt.getTime() - window.open.getTime()) / 60_000;
    if (minutesFromOpen % rules.slotStepMinutes !== 0) {
      throw new BadRequestException(
        `Un créneau doit commencer par tranche de ${rules.slotStepMinutes} minutes`,
      );
    }

    const resources = await this.loadResources(context.salonId, employeeId);
    const busy = await this.loadBusyIntervals(context.salonId, date);

    const free = resources.find((resource) =>
      this.isResourceFree(resource, busy, startsAt, endsAt),
    );

    if (!free) {
      throw new BadRequestException("Ce créneau n'est plus disponible");
    }

    return free.id;
  }

  // ============================================
  // Internes
  // ============================================

  private async computeSlots(
    salonId: string,
    openingHours: Record<string, DayHours | null>,
    date: string,
    durationMinutes: number,
    now: Date,
    employeeId?: string,
  ): Promise<Date[]> {
    const window = this.openingWindow(openingHours, date);
    if (!window) {
      return [];
    }

    const rules = getBookingRules();
    const resources = await this.loadResources(salonId, employeeId);
    const busy = await this.loadBusyIntervals(salonId, date);
    const earliestStart = new Date(
      now.getTime() + rules.minLeadMinutes * 60_000,
    );

    const slots: Date[] = [];
    const step = rules.slotStepMinutes * 60_000;
    const lastStart = window.close.getTime() - durationMinutes * 60_000;

    for (
      let startMs = window.open.getTime();
      startMs <= lastStart;
      startMs += step
    ) {
      const start = new Date(startMs);
      if (start.getTime() < earliestStart.getTime()) {
        continue;
      }

      const end = addMinutes(start, durationMinutes);
      const someoneFree = resources.some((resource) =>
        this.isResourceFree(resource, busy, start, end),
      );

      if (someoneFree) {
        slots.push(start);
      }
    }

    return slots;
  }

  /**
   * Ressources d'un salon.
   *
   * En V1 la liste est toujours vide en base : aucune route ne crée
   * d'`Employee`. On retombe alors sur la ressource implicite `null`, qui
   * correspond à la contrainte d'exclusion Postgres actuelle (clé `salonId`).
   *
   * La contrainte d'exclusion porte désormais sur
   * `COALESCE("employeeId", "salonId")` (migration `employee_scoped_overlap`) :
   * deux employés peuvent travailler au même instant, le même employé non.
   */
  private async loadResources(
    salonId: string,
    employeeId?: string,
  ): Promise<Resource[]> {
    const employees = await this.prisma.employee.findMany({
      // `employeeId` restreint au membre demandé par le client. Le filtre
      // `salonId` reste appliqué : un identifiant appartenant à un autre salon
      // ne renvoie rien, plutôt que d'exposer les disponibilités d'un tiers.
      where: { salonId, isActive: true, ...(employeeId && { id: employeeId }) },
      select: { id: true, workingHours: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (employees.length === 0) {
      // Un employeeId demandé mais introuvable ne doit PAS retomber sur la
      // ressource implicite : cela proposerait des créneaux au nom de
      // quelqu'un qui n'existe pas dans ce salon.
      if (employeeId) {
        throw new NotFoundException('Membre introuvable pour ce salon');
      }
      return [{ id: null, workingHours: null }];
    }

    return employees.map((employee) => ({
      id: employee.id,
      workingHours: employee.workingHours
        ? this.parseOpeningHours(employee.workingHours)
        : null,
    }));
  }

  /**
   * Réservations confirmées et créneaux bloqués du jour.
   * On élargit la fenêtre d'une journée de chaque côté : une réservation
   * commencée la veille au soir peut déborder sur le début de la journée.
   */
  private async loadBusyIntervals(
    salonId: string,
    date: string,
  ): Promise<BusyInterval[]> {
    const { start, end } = localDayRangeUtc(date);
    const from = new Date(start.getTime() - 24 * 60 * 60_000);
    const to = new Date(end.getTime() + 24 * 60 * 60_000);

    const [reservations, blocked] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          salonId,
          status: 'CONFIRMED',
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { startsAt: true, endsAt: true, employeeId: true },
      }),
      this.prisma.blockedSlot.findMany({
        where: {
          salonId,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { startsAt: true, endsAt: true, employeeId: true },
      }),
    ]);

    return [
      ...reservations.map((item) => ({
        start: item.startsAt,
        end: item.endsAt,
        employeeId: item.employeeId,
      })),
      ...blocked.map((item) => ({
        start: item.startsAt,
        end: item.endsAt,
        employeeId: item.employeeId,
      })),
    ];
  }

  private isResourceFree(
    resource: Resource,
    busy: BusyInterval[],
    start: Date,
    end: Date,
  ): boolean {
    // Horaires individuels (V2) : un employé peut travailler moins que le salon.
    if (resource.workingHours) {
      const window = this.openingWindow(
        resource.workingHours,
        utcToLocalDate(start),
      );
      if (
        !window ||
        start.getTime() < window.open.getTime() ||
        end.getTime() > window.close.getTime()
      ) {
        return false;
      }
    }

    return !busy.some((interval) => {
      // Un intervalle sans employeeId bloque tout le salon (fermeture
      // exceptionnelle, ou réservation de la ressource unique en V1).
      const concernsResource =
        interval.employeeId === null || interval.employeeId === resource.id;

      if (!concernsResource) {
        return false;
      }

      // Bornes semi-ouvertes `[start, end)` : deux RDV adjacents ne se
      // chevauchent pas. Cohérent avec le `tsrange(..., '[)')` de la
      // contrainte d'exclusion en base.
      return (
        interval.start.getTime() < end.getTime() &&
        interval.end.getTime() > start.getTime()
      );
    });
  }

  /** Fenêtre d'ouverture d'un jour, convertie en UTC. `null` si fermé. */
  private openingWindow(
    hours: Record<string, DayHours | null>,
    date: string,
  ): { open: Date; close: Date } | null {
    const weekday: WeekdayKey = weekdayOfLocalDate(date);
    const day = hours[weekday];

    if (!day || !day.open || !day.close) {
      return null;
    }

    const open = localToUtc(date, day.open);
    const close = localToUtc(date, day.close);

    // Un salon dont l'heure de fermeture précède l'ouverture est une donnée
    // incohérente : on préfère ne proposer aucun créneau plutôt qu'une grille
    // absurde.
    if (close.getTime() <= open.getTime()) {
      return null;
    }

    return { open, close };
  }

  private assertDateWithinHorizon(date: string, now: Date): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Date attendue au format YYYY-MM-DD');
    }

    const rules = getBookingRules();
    const today = utcToLocalDate(now);
    const { start: requestedDay } = localDayRangeUtc(date);
    const { start: firstDay } = localDayRangeUtc(today);

    const daysAhead = Math.round(
      (requestedDay.getTime() - firstDay.getTime()) / (24 * 60 * 60_000),
    );

    if (daysAhead < 0) {
      throw new BadRequestException('Cette date est déjà passée');
    }

    if (daysAhead >= rules.horizonDays) {
      throw new BadRequestException(
        `Les réservations sont ouvertes sur ${rules.horizonDays} jours`,
      );
    }
  }

  /**
   * `openingHours` est un champ Json : Prisma ne garantit aucune forme.
   * On le normalise ici plutôt que de laisser chaque appelant supposer une
   * structure — les DTO valident déjà la forme à l'écriture, mais des données
   * anciennes ou seedées à la main pourraient dévier.
   */
  private parseOpeningHours(raw: unknown): Record<string, DayHours | null> {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return {};
    }

    const result: Record<string, DayHours | null> = {};

    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        result[key] = null;
        continue;
      }

      const candidate = value as { open?: unknown; close?: unknown };
      if (
        typeof candidate.open === 'string' &&
        typeof candidate.close === 'string'
      ) {
        result[key] = { open: candidate.open, close: candidate.close };
      } else {
        result[key] = null;
      }
    }

    return result;
  }
}
