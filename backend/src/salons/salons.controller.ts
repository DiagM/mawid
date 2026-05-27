import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { PrestationsService } from '../prestations/prestations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
    private readonly prestationsService: PrestationsService,
  ) {}

  // ============================================
  // Routes protégées (gérant connecté)
  // IMPORTANT : déclarées AVANT /:slug pour éviter conflit de routing.
  // ============================================

  /**
   * GET /api/salons/me
   * Renvoie le salon du gérant connecté.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.salonsService.findMine(user.id);
  }

  /**
   * PATCH /api/salons/me
   * Met à jour le salon du gérant connecté.
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSalonDto,
  ) {
    return this.salonsService.updateMine(user.id, dto);
  }

  // ============================================
  // Routes publiques (clients finaux)
  // ============================================

  /**
   * GET /api/salons/:slug
   * Fiche publique du salon (avec ses prestations actives incluses).
   */
  @Get(':slug')
  findPublic(@Param('slug') slug: string) {
    return this.salonsService.findPublicBySlug(slug);
  }

  /**
   * GET /api/salons/:slug/prestations
   * Liste publique des prestations actives du salon.
   */
  @Get(':slug/prestations')
  findPublicPrestations(@Param('slug') slug: string) {
    return this.prestationsService.findPublicBySalonSlug(slug);
  }
}