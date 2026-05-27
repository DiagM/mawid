import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrestationsService } from './prestations.service';
import { CreatePrestationDto } from './dto/create-prestation.dto';
import { UpdatePrestationDto } from './dto/update-prestation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Routes prestations.
 *
 * Les routes /salons/:slug/prestations (publiques) sont déclarées dans
 * salons.controller via un nested resource pour éviter d'exposer les IDs
 * internes de salon dans l'API publique.
 *
 * Ici on a uniquement les routes protégées (gestion par le gérant).
 */
@Controller('prestations')
export class PrestationsController {
  constructor(private readonly prestationsService: PrestationsService) {}

  /**
   * GET /api/prestations/me
   * Liste les prestations du salon du gérant connecté (actives + archivées).
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.prestationsService.findMine(user.id);
  }

  /**
   * POST /api/prestations
   * Crée une prestation pour le salon du gérant.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePrestationDto,
  ) {
    return this.prestationsService.create(user.id, dto);
  }

  /**
   * PATCH /api/prestations/:id
   * Modifie une prestation.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePrestationDto,
  ) {
    return this.prestationsService.update(user.id, id, dto);
  }

  /**
   * DELETE /api/prestations/:id
   * Archive une prestation (soft delete).
   * On renvoie un 204 No Content (succès sans corps).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.prestationsService.archive(user.id, id);
  }
}