import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service';
import {
  CreateProductDto,
  CreateStockMovementDto,
  UpdateProductDto,
} from './dto/stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.stockService.findMine(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.stockService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.stockService.update(user.id, id, dto);
  }

  /**
   * POST /api/products/:id/movements
   * Entree ou sortie. La quantite ne change QUE par ici : c'est ce qui
   * garantit que le stock affiche et son historique restent d'accord.
   */
  @Post(':id/movements')
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockService.move(user.id, id, dto);
  }

  @Get(':id/movements')
  movements(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.stockService.movements(user.id, id);
  }
}
