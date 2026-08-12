import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateSalonAdminDto } from './dto/create-salon-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Routes admin plateforme (toi, fondateur). Réservées au rôle ADMIN.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/dashboard
   * Statistiques globales de la plateforme.
   */
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  /**
   * POST /api/admin/salons
   * Crée un salon + son compte gérant (onboarding par l'admin).
   */
  @Post('salons')
  createSalon(@Body() dto: CreateSalonAdminDto) {
    return this.adminService.createSalon(dto);
  }
}
