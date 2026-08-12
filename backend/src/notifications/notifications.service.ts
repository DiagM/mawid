import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import type {
  NotificationProvider,
  NotificationSendResult,
  ReservationForNotification,
} from './interfaces/notification-provider.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  /**
   * Délègue au provider actif (wa.me par défaut, cf. notifications.module.ts).
   */
  sendConfirmation(
    reservation: ReservationForNotification,
  ): Promise<NotificationSendResult> {
    return this.provider.sendConfirmation(reservation);
  }

  /**
   * Construit le lien de confirmation (wa.me) pour une réservation.
   * Utilisé par ReservationsService pour renvoyer `whatsappConfirmationUrl`
   * dans la réponse de POST /api/salons/:slug/reservations.
   */
  async buildConfirmationLink(
    reservation: ReservationForNotification,
  ): Promise<string> {
    const result = await this.sendConfirmation(reservation);

    if (!result.manualLink) {
      throw new Error(
        "Le provider de notification n'a pas fourni de lien de confirmation",
      );
    }

    return result.manualLink;
  }
}
