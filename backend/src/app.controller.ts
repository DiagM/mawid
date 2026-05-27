import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Endpoint de santé : vérifie que la connexion Prisma <-> Postgres fonctionne.
   * GET /api/health
   */
  @Get('health')
  async health() {
    // Compte les utilisateurs (0 normalement) pour valider la connexion
    const userCount = await this.prisma.user.count();
    const salonCount = await this.prisma.salon.count();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        users: userCount,
        salons: salonCount,
      },
    };
  }
}
