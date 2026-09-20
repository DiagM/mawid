import { fr, type WeekdayKey } from './i18n/fr';

/**
 * ============================================
 * Formatage — prix, téléphones, dates
 * ============================================
 */

/**
 * Prix stockés en centimes DZD entiers côté serveur (jamais de flottant).
 * On n'affiche pas les centimes : personne n'annonce « 1200,00 DA » dans un
 * salon, et les tarifs sont toujours des montants ronds.
 */
export function formatPrice(priceCents: number): string {
  const dinars = Math.round(priceCents / 100);
  return `${dinars.toLocaleString('fr-DZ').replace(/ | /g, ' ')} DA`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} ${fr.salon.minutes}`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

/**
 * Affichage local d'un numéro E.164 algérien : `+213555123456` → `0555 12 34 56`.
 * Les Algériens ne lisent pas leur numéro au format international.
 */
export function formatPhone(e164: string): string {
  const match = /^\+213([5-7]\d{8})$/.exec(e164);
  if (!match) {
    return e164;
  }

  const national = `0${match[1]}`;
  return `${national.slice(0, 4)} ${national.slice(4, 6)} ${national.slice(6, 8)} ${national.slice(8, 10)}`;
}

/**
 * Saisie locale → E.164, seul format accepté par l'API.
 * On accepte ce qu'un utilisateur tape réellement : espaces, points, tirets,
 * et aussi bien `0555…` que `+213555…` ou `00213555…`.
 *
 * @returns le numéro E.164, ou `null` si la saisie n'est pas un mobile algérien
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '');

  const national = /^0([5-7]\d{8})$/.exec(digits);
  if (national) {
    return `+213${national[1]}`;
  }

  const international = /^(?:\+213|00213)([5-7]\d{8})$/.exec(digits);
  if (international) {
    return `+213${international[1]}`;
  }

  return null;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Africa/Algiers',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'Africa/Algiers',
});

/**
 * Les dates viennent de l'API au format local `YYYY-MM-DD`. On les
 * réinterprète à midi UTC pour formater le bon jour sans qu'un décalage de
 * fuseau ne fasse basculer l'affichage la veille.
 */
function localDateToInstant(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatLongDate(date: string): string {
  return DATE_FORMATTER.format(localDateToInstant(date));
}

/**
 * Formate un INSTANT ISO complet (`2026-09-20T09:00:00.000Z`), là où
 * `formatLongDate` attend une date locale `YYYY-MM-DD`.
 *
 * Les deux existent parce que l'API renvoie les deux formes : les dates
 * métier (jour de rendez-vous) en date locale, les horodatages techniques
 * (dernière connexion, fin d'abonnement) en ISO. Passer l'une à l'autre
 * produit un `Invalid time value` qui ne se voit qu'à l'exécution, sur une
 * donnée non nulle — donc rarement en développement.
 */
export function formatInstantDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

export function formatShortDate(date: string): string {
  return SHORT_DATE_FORMATTER.format(localDateToInstant(date));
}

export function weekdayLabel(key: WeekdayKey): string {
  return fr.weekdays[key];
}

/** Décalage en jours entre deux dates locales `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  const a = localDateToInstant(from).getTime();
  const b = localDateToInstant(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Date locale `YYYY-MM-DD` du jour, dans le fuseau des salons. */
export function todayLocalDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

/** Ajoute des jours à une date locale `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const instant = localDateToInstant(date);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}
