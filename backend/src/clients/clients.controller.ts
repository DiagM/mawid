import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsQueryDto } from './dto/clients-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Fiches clients (V3).
 *
 * Toutes les routes sont scopees par ownerId, et une fiche ne montre que ce
 * que CE salon a vecu avec ce client — jamais ses rendez-vous ailleurs, alors
 * meme que l'entite Client est partagee entre salons.
 */
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClientsQueryDto,
  ) {
    return this.clientsService.findMine(user.id, query.q);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.findOne(user.id, id);
  }
}
