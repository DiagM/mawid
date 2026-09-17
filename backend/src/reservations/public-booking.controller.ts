import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AvailabilityService } from './availability.service';
import { ReservationsService } from './reservations.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { BOOKING_THROTTLE } from '../common/throttling/throttle-config';

/**
 * Parcours de réservation côté client final — aucune authentification.
 *
 * Les routes sont imbriquées sous le slug public du salon, comme
 * `/salons/:slug/prestations` : le client ne manipule jamais d'identifiant
 * interne de salon, et le serveur ne fait jamais confiance à un `salonId`
 * qui viendrait du corps de la requête.
 */
@Controller('salons/:slug')
export class PublicBookingController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly reservationsService: ReservationsService,
  ) {}

  /**
   * GET /api/salons/:slug/availability?date=YYYY-MM-DD&prestationIds=a,b
   * Créneaux réservables pour une sélection de prestations.
   */
  @Get('availability')
  getAvailability(
    @Param('slug') slug: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getAvailability(
      slug,
      query.date,
      query.prestationIds,
    );
  }

  /**
   * POST /api/salons/:slug/reservations
   * Crée la réservation. Renvoie le `cancellationToken` : c'est l'unique
   * occasion où le client le reçoit, il sert à construire son lien de gestion.
   */
  @Post('reservations')
  // Route publique, non authentifiée, sans vérification du numéro : c'est la
  // surface d'abus la plus évidente du produit.
  @Throttle(BOOKING_THROTTLE)
  create(@Param('slug') slug: string, @Body() dto: CreateReservationDto) {
    return this.reservationsService.createForSalon(slug, dto);
  }
}
