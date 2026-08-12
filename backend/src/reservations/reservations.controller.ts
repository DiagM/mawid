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
import { ReservationsService } from './reservations.service';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Routes réservations.
 *
 * Les routes GET /salons/:slug/availability et POST /salons/:slug/reservations
 * (publiques, consultation créneaux + création cliente) sont déclarées dans
 * salons.controller via un nested resource, pour rester cohérent avec le
 * pattern déjà utilisé pour les prestations (ne pas exposer les IDs internes
 * de salon dans l'URL publique).
 *
 * Ici : les routes qui ne dépendent pas du slug (accès via token
 * d'annulation, ou gestion par le gérant connecté).
 */
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  /**
   * GET /api/reservations/token/:token
   * Consultation publique d'une réservation via son token d'annulation
   * (lien envoyé par WhatsApp). N'expose jamais l'ID interne du salon.
   */
  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.reservationsService.findByToken(token);
  }

  /**
   * POST /api/reservations/token/:token/cancel
   * Annulation publique par le client via son token.
   */
  @Post('token/:token/cancel')
  cancelByToken(@Param('token') token: string) {
    return this.reservationsService.cancelByToken(token);
  }

  /**
   * GET /api/reservations/me/day?date=YYYY-MM-DD
   * Agenda du jour (réservations + blocages) du salon du gérant connecté.
   * `date` optionnel, défaut = aujourd'hui (heure d'Alger).
   */
  @Get('me/day')
  @UseGuards(JwtAuthGuard)
  findMyDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return this.reservationsService.findMyDay(user.id, date);
  }

  /**
   * PATCH /api/reservations/:id/status
   * Marque une réservation confirmée comme honorée (HONORED) ou non
   * honorée (NO_SHOW).
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
}
