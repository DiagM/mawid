import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SalonsModule } from './salons/salons.module';
import { PrestationsModule } from './prestations/prestations.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BlockedSlotsModule } from './blocked-slots/blocked-slots.module';
import { EmployeesModule } from './employees/employees.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StatsModule } from './stats/stats.module';
import { ClientsModule } from './clients/clients.module';
import { CashModule } from './cash/cash.module';
import { StockModule } from './stock/stock.module';
import { PaymentsModule } from './payments/payments.module';
import { getThrottlerOptions } from './common/throttling/throttle-config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot(getThrottlerOptions()),
    PrismaModule,
    AuthModule,
    PrestationsModule,
    SalonsModule,
    ReservationsModule,
    BlockedSlotsModule,
    EmployeesModule,
    ReviewsModule,
    StatsModule,
    ClientsModule,
    CashModule,
    StockModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Guard global : une nouvelle route est protégée par défaut, plutôt que
      // de dépendre du fait qu'on ait pensé à la décorer.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
