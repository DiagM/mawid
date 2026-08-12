import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { PrestationsService } from '../prestations/prestations.service';
import { ReservationsService } from '../reservations/reservations.service';
import { AvailabilityQueryDto } from '../reservations/dto/availability-query.dto';
import { CreateReservationDto } from '../reservations/dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
    private readonly prestationsService: PrestationsService,
    private readonly reservationsService: ReservationsService,
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

  /**
   * GET /api/salons/:slug/availability?prestationIds=a,b&days=7
   * Créneaux disponibles pour une combinaison de prestations.
   */
  @Get(':slug/availability')
  getAvailability(
    @Param('slug') slug: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.reservationsService.getAvailability(slug, query);
  }

  /**
   * POST /api/salons/:slug/reservations
   * Crée une réservation cliente (aucune authentification requise).
   */
  @Post(':slug/reservations')
  createReservation(
    @Param('slug') slug: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(slug, dto);
  }
}
