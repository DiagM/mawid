import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { PublicBookingController } from './public-booking.controller';
import { ReservationsService } from './reservations.service';
import { AvailabilityService } from './availability.service';

@Module({
  controllers: [PublicBookingController, ReservationsController],
  providers: [ReservationsService, AvailabilityService],
  exports: [ReservationsService, AvailabilityService],
})
export class ReservationsModule {}
