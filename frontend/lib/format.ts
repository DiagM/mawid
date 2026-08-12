import type { Weekday } from "./api";

/** Convertit un prix en centimes DZD vers un libellé lisible, ex: 150000 -> "1 500 DA". */
export function formatPrice(priceCents: number): string {
  const dzd = Math.round(priceCents / 100);
  return `${dzd.toLocaleString("fr-FR")} DA`;
}

/** Convertit une durée en minutes vers un libellé court, ex: 90 -> "1h30", 30 -> "30 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

export const WEEKDAY_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function weekdayLabel(day: Weekday): string {
  return WEEKDAY_LABELS[day];
}

/** Formate une date "YYYY-MM-DD" en libellé court français, ex: "lun. 12 août". */
export function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+01:00`);
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return label;
}

/** Renvoie "Aujourd'hui" / "Demain" ou le libellé court pour les autres jours. */
export function formatDayHeading(dateStr: string, todayStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+01:00`);
  const today = new Date(`${todayStr}T00:00:00+01:00`);
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return formatDateShort(dateStr);
}

/** Date du jour au format "YYYY-MM-DD", en heure d'Alger (UTC+1, fixe, pas de DST). */
export function todayAlgiersDateString(): string {
  const now = new Date();
  const algiers = new Date(now.getTime() + 60 * 60 * 1000);
  return algiers.toISOString().slice(0, 10);
}

/**
 * Construit l'instant UTC (ISO 8601) correspondant à une date+heure locale
 * d'Alger. Alger est fixe UTC+1 (pas de changement d'heure), donc on laisse
 * le suffixe "+01:00" faire la conversion via le constructeur Date natif.
 */
export function algiersDateTimeToUtcIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+01:00`).toISOString();
}

/** Formate un instant ISO (UTC) en heure d'Alger lisible, ex: "14:30". */
export function formatAlgiersTime(isoUtc: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Algiers",
  }).format(new Date(isoUtc));
}

/** Formate un instant ISO (UTC) en date lisible d'Alger, ex: "lundi 12 août". */
export function formatAlgiersDateLong(isoUtc: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Algiers",
  }).format(new Date(isoUtc));
}

/** Valide un numéro algérien complet, ex: "+213551234567". */
export function isValidAlgerianPhone(phone: string): boolean {
  return /^\+213[5-7]\d{8}$/.test(phone);
}

/**
 * Indique si un instant ISO (UTC) est déjà passé par rapport à l'instant
 * présent. Utilisé côté serveur, à la demande d'un rendu non mis en cache
 * (chaque requête recalcule cette valeur fraîchement).
 */
export function isInPast(isoUtc: string): boolean {
  return new Date(isoUtc).getTime() <= Date.now();
}
