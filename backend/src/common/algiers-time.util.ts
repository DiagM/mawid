/**
 * ============================================
 * Utilitaires de fuseau horaire — Alger (UTC+1 fixe)
 * ============================================
 * L'Algérie n'applique PAS l'heure d'été : le décalage avec UTC est
 * constant toute l'année (+60 minutes). On peut donc faire toutes les
 * conversions avec de simples additions/soustractions de millisecondes,
 * sans dépendance externe (pas de date-fns/dayjs/luxon).
 *
 * Toutes les fonctions ici sont pures et sans dépendance à Nest :
 * facilement testables unitairement (simple import + assertions).
 */

export const ALGIERS_OFFSET_MINUTES = 60;

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// Index 0 = dimanche, comme Date.prototype.getUTCDay()
const WEEKDAYS: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Composants d'une date calendaire (sans heure).
 */
export interface CalendarDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Composants d'un instant exprimé en heure locale d'Alger.
 */
export interface AlgiersLocalParts extends CalendarDateParts {
  hour: number; // 0-23
  minute: number; // 0-59
}

/**
 * Construit un instant UTC (Date) à partir de composants de date/heure
 * EXPRIMÉS en heure locale d'Alger.
 *
 * Ex: algiersPartsToUtc({year:2026,month:8,day:12,hour:9,minute:0})
 *     -> Date représentant 2026-08-12T08:00:00.000Z (09:00 Alger = 08:00 UTC)
 */
export function algiersPartsToUtc(parts: AlgiersLocalParts): Date {
  // On construit d'abord l'instant "comme si" les composants étaient déjà
  // en UTC, puis on retire l'offset d'Alger (+60 min) pour obtenir le VRAI
  // instant UTC correspondant.
  const naiveUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
  );
  return new Date(naiveUtcMs - ALGIERS_OFFSET_MINUTES * 60_000);
}

/**
 * Décompose un instant UTC en composants de date/heure locale d'Alger.
 */
export function utcToAlgiersParts(date: Date): AlgiersLocalParts {
  const shifted = new Date(date.getTime() + ALGIERS_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/**
 * Renvoie le jour de la semaine (clé utilisée dans Salon.openingHours)
 * correspondant à un instant UTC, en heure locale d'Alger.
 */
export function getAlgiersWeekday(date: Date): Weekday {
  const shifted = new Date(date.getTime() + ALGIERS_OFFSET_MINUTES * 60_000);
  return WEEKDAYS[shifted.getUTCDay()];
}

/**
 * Formatte un instant UTC en date locale d'Alger "YYYY-MM-DD".
 */
export function formatAlgiersDate(date: Date): string {
  const { year, month, day } = utcToAlgiersParts(date);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Formatte un instant UTC en heure locale d'Alger "HH:mm".
 */
export function formatAlgiersTime(date: Date): string {
  const { hour, minute } = utcToAlgiersParts(date);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse une chaîne "YYYY-MM-DD" en composants de date calendaire.
 * Lève une Error (à catcher en BadRequestException côté service) si le
 * format est invalide.
 */
export function parseDateOnly(dateStr: string): CalendarDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(
      `Format de date invalide (attendu YYYY-MM-DD) : ${dateStr}`,
    );
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Parse une chaîne "HH:mm" en { hour, minute }.
 */
export function parseTimeOnly(timeStr: string): {
  hour: number;
  minute: number;
} {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!match) {
    throw new Error(`Format d'heure invalide (attendu HH:mm) : ${timeStr}`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Ajoute `days` jours calendaires à une date calendaire.
 * Date.UTC est utilisé ici uniquement comme calculateur calendaire (aucun
 * instant réel n'est représenté) : le décalage Alger n'intervient donc pas.
 */
export function addCalendarDays(
  parts: CalendarDateParts,
  days: number,
): CalendarDateParts {
  const ms = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const shifted = new Date(ms);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Génère tous les créneaux de DÉBUT (instants UTC) entre `openUtc` (inclus)
 * et `closeUtc` (exclu), espacés de `stepMinutes`.
 *
 * Ne fait AUCUNE vérification de durée de prestation ni de conflit de
 * réservation : c'est au service appelant (module réservations) de filtrer
 * les créneaux dont [slot, slot + duréeTotale) dépasse `closeUtc` ou
 * chevauche un rendez-vous/blocage existant.
 */
export function generateSlots(
  openUtc: Date,
  closeUtc: Date,
  stepMinutes = 30,
): Date[] {
  const slots: Date[] = [];
  const stepMs = stepMinutes * 60_000;
  const endMs = closeUtc.getTime();

  for (let cursor = openUtc.getTime(); cursor < endMs; cursor += stepMs) {
    slots.push(new Date(cursor));
  }

  return slots;
}
