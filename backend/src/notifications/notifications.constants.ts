/**
 * Jeton d'injection Nest pour le provider de notification actif.
 * Permet de changer d'implémentation (wa.me -> WhatsApp Cloud API payante)
 * en ne modifiant QUE notifications.module.ts.
 */
export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');
