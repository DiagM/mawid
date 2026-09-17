import { Module } from '@nestjs/common';
import { PrestationsController } from './prestations.controller';
import { PrestationsService } from './prestations.service';

@Module({
  controllers: [PrestationsController],
  providers: [PrestationsService],
  exports: [PrestationsService],
})
export class PrestationsModule {}
