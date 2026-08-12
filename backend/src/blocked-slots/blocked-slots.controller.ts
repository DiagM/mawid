import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlockedSlotsService } from './blocked-slots.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Routes blocages de créneaux. Toutes protégées : réservées au gérant
 * connecté, portant uniquement sur son propre salon.
 */
@Controller('blocked-slots')
@UseGuards(JwtAuthGuard)
export class BlockedSlotsController {
  constructor(private readonly blockedSlotsService: BlockedSlotsService) {}

  /**
   * POST /api/blocked-slots
   * Crée un blocage pour le salon du gérant connecté.
   */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockedSlotDto,
  ) {
    return this.blockedSlotsService.create(user.id, dto);
  }

  /**
   * GET /api/blocked-slots/me?date=YYYY-MM-DD
   * Liste les blocages du salon (filtrés sur une journée si `date` fourni,
   * sinon tous les blocages à venir).
   */
  @Get('me')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
  ) {
    return this.blockedSlotsService.findMine(user.id, date);
  }

  /**
   * DELETE /api/blocked-slots/:id
   * Supprime un blocage.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.blockedSlotsService.remove(user.id, id);
  }
}
