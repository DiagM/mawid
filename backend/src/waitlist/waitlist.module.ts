import { Module } from '@nestjs/common';
import {
  PublicWaitlistController,
  WaitlistController,
} from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { ReservationsModule } from '../reservations/reservations.module';

/**
 * `ReservationsModule` pour `AvailabilityService` : c'est lui qui dit si une
 * journée est réellement complète. Refaire ce calcul ici aurait produit une
 * seconde vérité sur les créneaux, et la divergence n'aurait été visible que
 * le jour où une cliente se serait inscrite sur une liste d'attente alors
 * qu'une place était libre.
 */
@Module({
  imports: [ReservationsModule],
  controllers: [PublicWaitlistController, WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
