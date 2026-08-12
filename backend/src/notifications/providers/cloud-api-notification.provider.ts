import { Injectable } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationSendResult,
} from '../interfaces/notification-provider.interface';

/**
 * Provider WhatsApp Cloud API (Meta) — DÉSACTIVÉ PAR DÉFAUT.
 *
 * Ce provider n'est PAS injecté dans notifications.module.ts et n'est
 * appelé nulle part dans le code actif. Il existe uniquement pour montrer
 * où brancher le futur envoi automatique payant, une fois qu'un compte
 * Meta Business + un numéro WhatsApp Business seront disponibles.
 *
 * Pour l'activer un jour :
 *   1. Configurer les credentials Meta (token, phone number id) via env vars.
 *   2. Implémenter l'appel HTTP réel vers l'API Graph de Meta ci-dessous.
 *   3. Dans notifications.module.ts, remplacer
 *      `{ provide: NOTIFICATION_PROVIDER, useClass: WameNotificationProvider }`
 *      par `useClass: CloudApiNotificationProvider` (un seul endroit à changer,
 *      aucun call site ailleurs dans le code à toucher).
 */
@Injectable()
export class CloudApiNotificationProvider implements NotificationProvider {
  sendConfirmation(): Promise<NotificationSendResult> {
    throw new Error(
      'WhatsApp Cloud API not configured — this is a paid Meta service, ' +
        'disabled by default. See NotificationsModule for how to enable it ' +
        'once you have a Meta Business account.',
    );
  }
}
