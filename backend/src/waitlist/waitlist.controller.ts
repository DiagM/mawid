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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WaitlistService } from './waitlist.service';
import {
  JoinWaitlistDto,
  MarkNotifiedDto,
  WaitlistQueryDto,
} from './dto/waitlist.dto';
import { BOOKING_THROTTLE } from '../common/throttling/throttle-config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Inscription publique sur la liste d'attente d'un salon.
 *
 * Même surface d'abus que la réservation — route ouverte, sans compte — donc
 * même plafond de débit et même honeypot.
 */
@Controller('salons/:slug/waitlist')
export class PublicWaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Throttle(BOOKING_THROTTLE)
  join(@Param('slug') slug: string, @Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(slug, dto);
  }
}

/** Liste d'attente vue par le gérant. */
@Controller('waitlist')
@UseGuards(JwtAuthGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /** GET /api/waitlist?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WaitlistQueryDto,
  ) {
    return this.waitlistService.findMine(user.id, query);
  }

  /**
   * PATCH /api/waitlist/:id
   * Marque la demande comme traitée. La ligne reste : sans trace, le gérant
   * rappellerait deux fois la même personne.
   */
  @Patch(':id')
  setNotified(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkNotifiedDto,
  ) {
    return this.waitlistService.setNotified(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.waitlistService.remove(user.id, id);
  }
}
