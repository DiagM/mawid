/**
 * Représentation minimale d'une réservation nécessaire pour construire un
 * message de confirmation. Volontairement découplée du modèle Prisma complet
 * pour ne pas coupler les providers à la couche base de données.
 */
export interface ReservationForNotification {
  clientFirstName: string;
  clientPhone: string;
  startsAt: Date;
  cancellationToken: string;
  salonName: string;
  prestationNames: string[];
  totalPriceCents: number;
}

/**
 * Résultat d'un envoi (ou tentative d'envoi) de notification.
 *
 * - `sent`: true si le message a réellement été transmis par un service tiers
 *   (ex: WhatsApp Cloud API). En V1, toujours false : on ne fait QUE générer
 *   un lien manuel (wa.me) que l'utilisateur doit lui-même cliquer.
 * - `manualLink`: lien cliquable (ex: https://wa.me/...) à afficher côté
 *   frontend quand aucun envoi automatique n'a eu lieu.
 */
export interface NotificationSendResult {
  sent: boolean;
  manualLink?: string;
}

/**
 * Interface commune à tous les providers de notification.
 *
 * But : permettre de brancher un jour un vrai provider payant (WhatsApp
 * Cloud API, SMS...) sans jamais toucher aux call sites (ReservationsService
 * etc.) — seul notifications.module.ts change (un seul `useClass`).
 */
export interface NotificationProvider {
  sendConfirmation(
    reservation: ReservationForNotification,
  ): Promise<NotificationSendResult>;
}
