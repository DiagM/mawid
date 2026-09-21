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
import {
  MarkRemindedDto,
  UpdateReservationStatusDto,
} from './dto/update-reservation-status.dto';
import {
  RescheduleAvailabilityQueryDto,
  RescheduleReservationDto,
} from './dto/reschedule-reservation.dto';
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
   * GET /api/reservations/quota
   * Consommation du quota mensuel du salon du gérant connecté.
   * Déclarée avant /:id/status : aucun conflit, les préfixes diffèrent.
   */
  @Get('quota')
  @UseGuards(JwtAuthGuard)
  quota(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.quotaForManager(user.id);
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

  /**
   * GET /api/reservations/reminders?date=YYYY-MM-DD
   * Rendez-vous à rappeler, par défaut ceux de demain. Déclarée avant
   * /:id/... : aucun conflit, les préfixes diffèrent.
   */
  @Get('reminders')
  @UseGuards(JwtAuthGuard)
  reminders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AgendaQueryDto,
  ) {
    return this.reservationsService.remindersFor(user.id, query.from);
  }

  /** PATCH /api/reservations/:id/reminded — rappel envoyé, ou non. */
  @Patch(':id/reminded')
  @UseGuards(JwtAuthGuard)
  setReminded(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkRemindedDto,
  ) {
    return this.reservationsService.setReminded(user.id, id, dto.reminded);
  }

  /**
   * PATCH /api/reservations/:id/reschedule
   * Déplace un rendez-vous depuis l'agenda. C'est le cas le plus fréquent en
   * pratique : c'est le salon qui appelle pour décaler, pas la cliente.
   */
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleReservationDto,
  ) {
    return this.reservationsService.rescheduleByManager(user.id, id, dto);
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

  /**
   * GET /api/reservations/token/:token/availability?date=YYYY-MM-DD
   * Créneaux proposés pour déplacer CE rendez-vous. Le sien est exclu des
   * intervalles occupés, sinon il se bloquerait lui-même.
   */
  @Get('token/:token/availability')
  @Throttle(TOKEN_THROTTLE)
  rescheduleOptions(
    @Param('token') token: string,
    @Query() query: RescheduleAvailabilityQueryDto,
  ) {
    return this.reservationsService.availabilityForReschedule(
      token,
      query.date,
    );
  }

  /**
   * PATCH /api/reservations/token/:token/reschedule
   * La cliente déplace son rendez-vous. Le token reste le même : le lien
   * qu'elle a déjà dans WhatsApp continue de fonctionner.
   */
  @Patch('token/:token/reschedule')
  @Throttle(TOKEN_THROTTLE)
  rescheduleByToken(
    @Param('token') token: string,
    @Body() dto: RescheduleReservationDto,
  ) {
    return this.reservationsService.rescheduleByToken(token, dto);
  }
}
