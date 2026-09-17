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
import { BlockedSlotsQueryDto } from './dto/blocked-slots-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Gestion des indisponibilités du salon. Toutes les routes sont protégées :
 * un créneau bloqué n'a aucune raison d'être visible publiquement, il se
 * traduit simplement par l'absence de créneaux dans la disponibilité.
 */
@Controller('blocked-slots')
@UseGuards(JwtAuthGuard)
export class BlockedSlotsController {
  constructor(private readonly blockedSlotsService: BlockedSlotsService) {}

  /** GET /api/blocked-slots?from=YYYY-MM-DD&to=YYYY-MM-DD */
  @Get()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BlockedSlotsQueryDto,
  ) {
    return this.blockedSlotsService.findMine(user.id, query.from, query.to);
  }

  /** POST /api/blocked-slots */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockedSlotDto,
  ) {
    return this.blockedSlotsService.create(user.id, dto);
  }

  /**
   * DELETE /api/blocked-slots/:id
   * Suppression réelle : contrairement aux prestations, un blocage passé n'a
   * aucune valeur historique.
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
