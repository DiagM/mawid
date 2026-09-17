import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReservationsService } from './reservations.service';
import { AgendaQueryDto } from './dto/agenda-query.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { TOKEN_THROTTLE } from '../common/throttling/throttle-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // ============================================
  // Agenda du gérant (protégé)
  // Déclaré AVANT les routes /token/:token pour la lisibilité ; aucun conflit
  // de routing possible, les préfixes sont distincts.
  // ============================================

  /**
   * GET /api/reservations/me?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Agenda du salon du gérant connecté. Sans bornes : la journée en cours.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AgendaQueryDto,
  ) {
    return this.reservationsService.findMine(user.id, query.from, query.to);
  }

  /**
   * PATCH /api/reservations/:id/status
   * Qualifie un RDV (honoré, non présenté, annulé par le salon).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return this.reservationsService.updateStatus(user.id, id, dto);
  }

  // ============================================
  // Gestion par le client, via son token (public)
  // ============================================

  /**
   * GET /api/reservations/token/:token
   * Page de gestion du RDV côté client. Le token est un secret porteur :
   * il ne doit apparaître dans aucun log et la réponse reste minimale.
   */
  @Get('token/:token')
  @Throttle(TOKEN_THROTTLE)
  findByToken(@Param('token') token: string) {
    return this.reservationsService.findByToken(token);
  }

  /**
   * DELETE /api/reservations/token/:token
   * Annulation par le client. Passe le statut à CANCELED, ce qui libère
   * immédiatement le créneau (la contrainte d'exclusion ne porte que sur
   * les réservations CONFIRMED).
   */
  @Delete('token/:token')
  @Throttle(TOKEN_THROTTLE)
  cancelByToken(@Param('token') token: string) {
    return this.reservationsService.cancelByToken(token);
  }
}
