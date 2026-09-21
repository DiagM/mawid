import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { MapsLinkService } from './maps-link.service';
import { PrestationsModule } from '../prestations/prestations.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [PrestationsModule, ReviewsModule],
  controllers: [SalonsController],
  providers: [SalonsService, MapsLinkService],
  exports: [SalonsService],
})
export class SalonsModule {}
