import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { MailerService } from './mailer.service';

/**
 * `SupportService` est exporté : la console d'administration l'utilise pour
 * traiter la file, plutôt que de réimplémenter une seconde lecture des
 * mêmes données.
 */
@Module({
  controllers: [SupportController],
  providers: [SupportService, MailerService],
  exports: [SupportService],
})
export class SupportModule {}
