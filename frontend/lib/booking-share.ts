import type { ReservationView } from './api';
import { formatLongDate, formatPrice } from './format';

/**
 * ============================================
 * Partage d'une réservation — sans serveur d'envoi
 * ============================================
 * Décision produit centrale (docs/MVP_SCOPE.md §3.1) : Mawid n'envoie AUCUN
 * message. Pas de WhatsApp Cloud API, pas de SMS, donc zéro coût.
 *
 * À la place, c'est le téléphone du client qui envoie, via un lien `wa.me`.
 * Le gérant reçoit une vraie notification WhatsApp native sur son téléphone,
 * sans qu'aucun compte Meta ni aucun quota n'entre en jeu.
 *
 * Le fichier `.ics` complète le dispositif : il fait office de rappel
 * automatique gratuit, via l'agenda natif du téléphone, et transporte le lien
 * de gestion pour que le client ne le perde pas.
 */

/** `wa.me` attend le numéro sans `+` ni séparateur. */
function waNumber(e164: string): string {
  return e164.replace(/\D/g, '');
}

function reservationSummary(reservation: ReservationView): string {
  const services = reservation.prestations.map((p) => p.name).join(' + ');
  const date = formatLongDate(reservation.localDate);
  return `${services} — ${date} à ${reservation.localTime}`;
}

/**
 * Message pré-rempli adressé au salon.
 * Le client n'a plus qu'à appuyer sur « envoyer » : c'est cette action qui
 * remplace la notification serveur qu'on ne peut pas se payer.
 */
export function salonWhatsAppLink(reservation: ReservationView): string | null {
  if (!reservation.salon) {
    return null;
  }

  const message = [
    `Bonjour ${reservation.salon.name},`,
    '',
    `Je viens de réserver sur Mawid :`,
    `• ${reservationSummary(reservation)}`,
    `• Au nom de ${reservation.clientFirstName}`,
    '',
    'À bientôt !',
  ].join('\n');

  return `https://wa.me/${waNumber(reservation.salon.contactPhone)}?text=${encodeURIComponent(message)}`;
}

/** Lien d'appel direct, pour les clients qui préfèrent le téléphone. */
export function salonPhoneLink(contactPhone: string): string {
  return `tel:${contactPhone}`;
}

/** URL publique de gestion du rendez-vous. */
export function manageUrl(token: string, origin: string): string {
  return `${origin}/r/${token}`;
}

/** Échappement iCalendar : virgules, points-virgules et retours à la ligne. */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icsDate(iso: string): string {
  return `${iso.replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Fichier iCalendar du rendez-vous.
 *
 * Les dates sont écrites en UTC (suffixe `Z`) : c'est l'agenda du téléphone
 * qui les réaffiche dans le fuseau du client, sans qu'on ait à embarquer une
 * définition de fuseau horaire dans le fichier.
 *
 * L'alarme à -2 h est ce qui remplace le rappel WhatsApp J-1 qu'on ne peut
 * pas automatiser gratuitement.
 */
export function buildIcs(
  reservation: ReservationView,
  manageLink: string,
): string {
  const salonName = reservation.salon?.name ?? 'Mawid';
  const services = reservation.prestations.map((p) => p.name).join(' + ');
  const total = formatPrice(reservation.totalPriceCents);

  const description = [
    `${services} — ${total}`,
    '',
    `Modifier ou annuler : ${manageLink}`,
  ].join('\n');

  // CRLF obligatoire : certains clients de calendrier refusent le LF seul.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mawid//Reservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reservation.id}@mawid`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(reservation.startsAt)}`,
    `DTEND:${icsDate(reservation.endsAt)}`,
    `SUMMARY:${icsEscape(`${services} — ${salonName}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${icsEscape(manageLink)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`Rendez-vous chez ${salonName}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Nom de fichier lisible, sans caractère problématique selon les systèmes. */
export function icsFileName(reservation: ReservationView): string {
  const salon = (reservation.salon?.name ?? 'mawid')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `rdv-${salon}-${reservation.localDate}.ics`;
}
