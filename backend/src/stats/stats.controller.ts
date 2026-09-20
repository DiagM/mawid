import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /api/stats/me?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Tableau de bord du salon du gerant connecte.
   */
  @Get('me')
  forManager(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsQueryDto,
  ) {
    return this.statsService.forManager(user.id, query.from, query.to);
  }
}
