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
import { CashService } from './cash.service';
import {
  CashDayQueryDto,
  CreateCashMovementDto,
} from './dto/cash-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('cash')
@UseGuards(JwtAuthGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  /** GET /api/cash?date=YYYY-MM-DD — journal du jour et son total. */
  @Get()
  findDay(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CashDayQueryDto,
  ) {
    return this.cashService.findDay(user.id, query.date);
  }

  /**
   * GET /api/cash/pending — rendez-vous honores du jour pas encore encaisses.
   * C'est ce qui evite au gerant de ressaisir ce que Mawid connait deja.
   */
  @Get('pending')
  pending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CashDayQueryDto,
  ) {
    return this.cashService.pendingReservations(user.id, query.date);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cashService.create(user.id, dto);
  }

  /** Suppression reelle : un journal qui garde les lignes fausses n'en est plus un. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.cashService.remove(user.id, id);
  }
}
