import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_PROVIDER } from './notifications.constants';
import { WameNotificationProvider } from './providers/wame-notification.provider';

@Module({
  providers: [
    NotificationsService,
    // Provider actif en V1 : lien wa.me manuel, zéro coût.
    // Pour brancher un provider payant plus tard (WhatsApp Cloud API), il
    // suffit de changer cette ligne (cf. cloud-api-notification.provider.ts).
    { provide: NOTIFICATION_PROVIDER, useClass: WameNotificationProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
