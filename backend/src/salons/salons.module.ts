import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { PrestationsModule } from '../prestations/prestations.module';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [PrestationsModule, ReservationsModule],
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
