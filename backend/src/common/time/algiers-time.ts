/**
 * ============================================
 * Conversions de fuseau horaire — point unique
 * ============================================
 * Toute conversion entre l'heure locale d'un salon et l'UTC passe par ce
 * fichier. Disperser ces calculs serait le meilleur moyen d'obtenir des
 * réservations décalées d'une heure à un endroit et pas à un autre.
 *
 * Règle du projet : la base et l'API ne manipulent que de l'UTC
 * (`DateTime` Prisma = `TIMESTAMP(3)` sans fuseau). L'heure locale n'existe
 * que sur deux frontières : les horaires d'ouverture saisis par le gérant
 * (`"09:00"`) et l'affichage côté client.
 *
 * L'Algérie est à UTC+1 toute l'année, sans heure d'été, mais l'offset n'est
 * volontairement PAS codé en dur : on interroge `Intl`, qui connaît la base
 * IANA. Un offset en dur est exactement le genre de raccourci qui casse
 * silencieusement le jour où la règle change.
 */

/** Fuseau de référence. V1 : Alger uniquement. */
export const SALON_TIMEZONE = 'Africa/Algiers';

/**
 * Clés de jour telles que stockées dans `Salon.openingHours`.
 * L'ordre suit `Date#getUTCDay()` (0 = dimanche) pour pouvoir indexer
 * directement sans table de correspondance intermédiaire.
 */
export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Découpage d'un instant exprimé dans le fuseau du salon. */
export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  /** Date locale au format `YYYY-MM-DD`. */
  date: string;
  /** Heure locale au format `HH:mm`. */
  time: string;
  weekday: WeekdayKey;
}

const PART_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SALON_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * Offset du fuseau du salon, en minutes, à un instant donné.
 * Positif à l'est de Greenwich (+60 pour Alger).
 */
function offsetMinutesAt(instant: Date): number {
  const parts = PART_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) {
      throw new Error(`Partie de date manquante : ${type}`);
    }
    return Number(found.value);
  };

  // On réinterprète l'heure murale locale comme si elle était en UTC :
  // l'écart avec l'instant réel EST l'offset du fuseau.
  const wallClockAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );

  return (wallClockAsUtc - instant.getTime()) / 60_000;
}

/**
 * Convertit une heure murale locale en instant UTC.
 *
 * @param date `YYYY-MM-DD` tel que saisi/affiché côté salon
 * @param time `HH:mm` dans le fuseau du salon
 *
 * Pour un fuseau à offset fixe comme Alger, la conversion est exacte. Dans un
 * fuseau à heure d'été, les heures inexistantes ou ambiguës du changement
 * d'heure seraient à traiter explicitement — ce n'est pas le cas ici.
 */
export function localToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // L'offset est évalué à l'instant approché, ce qui suffit tant que le
  // fuseau ne bascule pas dans l'heure qui suit (jamais le cas à Alger).
  const offset = offsetMinutesAt(new Date(naive));

  return new Date(naive - offset * 60_000);
}

/** Décompose un instant UTC dans le fuseau du salon. */
export function utcToLocalParts(instant: Date): LocalParts {
  const parts = PART_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) {
      throw new Error(`Partie de date manquante : ${type}`);
    }
    return Number(found.value);
  };

  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour');
  const minute = read('minute');

  // getUTCDay() sur l'heure murale réinterprétée en UTC donne le jour local.
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    hour,
    minute,
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    weekday: WEEKDAY_KEYS[weekdayIndex],
  };
}

/** Heure locale `HH:mm` d'un instant UTC — raccourci d'affichage. */
export function utcToLocalTime(instant: Date): string {
  return utcToLocalParts(instant).time;
}

/** Date locale `YYYY-MM-DD` d'un instant UTC. */
export function utcToLocalDate(instant: Date): string {
  return utcToLocalParts(instant).date;
}

/** Jour de la semaine local d'une date `YYYY-MM-DD`. */
export function weekdayOfLocalDate(date: string): WeekdayKey {
  const [year, month, day] = date.split('-').map(Number);
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_KEYS[index];
}

/**
 * Bornes UTC d'une journée locale complète (00:00 inclus → 24:00 exclu).
 * Sert à charger les réservations d'un jour donné sans risquer d'en oublier
 * une à cause du décalage.
 */
export function localDayRangeUtc(date: string): { start: Date; end: Date } {
  const start = localToUtc(date, '00:00');
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/** Ajoute des minutes à un instant, sans muter l'original. */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}
