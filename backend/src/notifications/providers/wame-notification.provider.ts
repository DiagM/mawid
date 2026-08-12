import { Injectable } from '@nestjs/common';
import {
  getAlgiersWeekday,
  formatAlgiersTime,
  utcToAlgiersParts,
  Weekday,
} from '../../common/algiers-time.util';
import {
  NotificationProvider,
  NotificationSendResult,
  ReservationForNotification,
} from '../interfaces/notification-provider.interface';

const FRENCH_WEEKDAYS: Record<Weekday, string> = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche',
};

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Formatte un instant UTC en date française lisible, en heure locale
 * d'Alger. Ex: "mercredi 12 août 2026".
 */
function formatFrenchDate(date: Date): string {
  const weekday = getAlgiersWeekday(date);
  const { year, month, day } = utcToAlgiersParts(date);
  return `${FRENCH_WEEKDAYS[weekday]} ${day} ${FRENCH_MONTHS[month - 1]} ${year}`;
}

/**
 * Formatte un prix en centimes DZD en une chaîne "800 DZD".
 */
function formatPriceDzd(priceCents: number): string {
  const dzd = Math.round(priceCents / 100);
  return `${dzd.toLocaleString('fr-FR')} DZD`;
}

/**
 * Provider "gratuit" par défaut : ne fait AUCUN appel réseau.
 * Se contente de construire un lien https://wa.me/... avec un message
 * pré-rempli, que le gérant ou le client doit cliquer/envoyer manuellement.
 *
 * Zéro coût, zéro dépendance à un service tiers payant — conforme à la
 * contrainte produit V1 (pas de WhatsApp Cloud API, pas de SMS payant).
 */
@Injectable()
export class WameNotificationProvider implements NotificationProvider {
  sendConfirmation(
    reservation: ReservationForNotification,
  ): Promise<NotificationSendResult> {
    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const cancellationUrl = `${publicBaseUrl}/annulation/${reservation.cancellationToken}`;

    const message =
      `Bonjour ${reservation.clientFirstName}, ton rendez-vous chez ` +
      `${reservation.salonName} est confirmé le ${formatFrenchDate(reservation.startsAt)} ` +
      `à ${formatAlgiersTime(reservation.startsAt)} pour ${reservation.prestationNames.join(', ')}. ` +
      `Prix total : ${formatPriceDzd(reservation.totalPriceCents)}. ` +
      `Pour annuler : ${cancellationUrl}`;

    // wa.me attend un numéro sans "+" ni espaces, chiffres uniquement.
    const digitsOnlyPhone = reservation.clientPhone.replace(/\D/g, '');
    const manualLink = `https://wa.me/${digitsOnlyPhone}?text=${encodeURIComponent(message)}`;

    // `sent: false` car rien n'est réellement transmis côté serveur : c'est
    // un lien manuel à cliquer par un humain.
    return Promise.resolve({ sent: false, manualLink });
  }
}
