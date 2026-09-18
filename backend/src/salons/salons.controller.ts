import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SearchSalonsDto } from './dto/search-salons.dto';
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
   * GET /api/salons?city=Alger&q=barbe&womenOnly=true
   * Recherche publique. Déclarée avant /:slug par lisibilité ; aucun conflit
   * de routing possible, la racine de collection n'a pas de segment.
   */
  @Get()
  search(@Query() query: SearchSalonsDto) {
    return this.salonsService.search(query);
  }

  /**
   * GET /api/salons/sitemap
   * Slugs des salons actifs, pour la génération du sitemap côté frontend.
   * Déclarée AVANT /:slug, sinon "sitemap" serait interprété comme un slug.
   */
  @Get('sitemap')
  sitemap() {
    return this.salonsService.findActiveSlugs();
  }

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
