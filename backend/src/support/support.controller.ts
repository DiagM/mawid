import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/support.dto';
import { BOOKING_THROTTLE } from '../common/throttling/throttle-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Deux routes pour une même demande, et c'est délibéré.
 *
 * Une seule route qui lirait « au cas où » un jeton présent serait plus
 * compacte mais plus trouble : on ne saurait plus, en lisant le code, si une
 * requête donnée est authentifiée. Ici la séparation est explicite, et
 * `/mine` ne peut rien faire sans JWT valide.
 */
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * POST /api/support/tickets
   * Page contact publique. Troisième surface d'écriture ouverte du produit
   * après la réservation et l'inscription : même plafond de débit, même
   * honeypot.
   */
  @Post()
  @Throttle(BOOKING_THROTTLE)
  create(@Body() dto: CreateTicketDto) {
    return this.supportService.create(dto);
  }

  /**
   * POST /api/support/tickets/mine
   * Depuis le back-office. Le salon est déduit du JWT, jamais du corps.
   */
  @Post('mine')
  @UseGuards(JwtAuthGuard)
  createMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.create(dto, user.id);
  }
}
