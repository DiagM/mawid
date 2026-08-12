import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SalonsModule } from './salons/salons.module';
import { PrestationsModule } from './prestations/prestations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BlockedSlotsModule } from './blocked-slots/blocked-slots.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PrestationsModule,
    SalonsModule,
    NotificationsModule,
    ReservationsModule,
    BlockedSlotsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
