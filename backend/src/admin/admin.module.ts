import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [SupportModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
