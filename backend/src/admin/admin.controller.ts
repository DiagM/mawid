import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AdminReviewsQueryDto,
  AdminSalonsQueryDto,
  CreateManagerDto,
  ModerateReviewDto,
  UpdateSalonAdminDto,
} from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Console d'administration de la plateforme (le fondateur).
 *
 * Les deux guards sont posés au niveau de la CLASSE, et non route par route :
 * une route ajoutée ici plus tard est protégée par défaut, plutôt que de
 * dépendre du fait qu'on ait pensé à la décorer. C'est le contrôleur où
 * l'oubli coûterait le plus cher — il voit tous les salons.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /api/admin/overview — chiffres de la plateforme. */
  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  /** GET /api/admin/salons?status=pending&q=texte */
  @Get('salons')
  findSalons(@Query() query: AdminSalonsQueryDto) {
    return this.adminService.findSalons(query);
  }

  /**
   * PATCH /api/admin/salons/:id
   * Valider un salon, changer son offre, vendre une mise en avant.
   */
  @Patch('salons/:id')
  updateSalon(@Param('id') id: string, @Body() dto: UpdateSalonAdminDto) {
    return this.adminService.updateSalon(id, dto);
  }

  /**
   * POST /api/admin/managers
   * Onboarding commercial : crée le gérant, son salon, et renvoie le mot de
   * passe initial — affiché une seule fois.
   */
  @Post('managers')
  createManager(@Body() dto: CreateManagerDto) {
    return this.adminService.createManager(dto);
  }

  /** POST /api/admin/managers/:id/reset-password */
  @Post('managers/:id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.adminService.resetManagerPassword(id);
  }

  /** GET /api/admin/reviews?visibility=hidden&maxRating=2 */
  @Get('reviews')
  findReviews(@Query() query: AdminReviewsQueryDto) {
    return this.adminService.findReviews(query);
  }

  /** PATCH /api/admin/reviews/:id — masquer ou republier un avis. */
  @Patch('reviews/:id')
  moderateReview(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.adminService.moderateReview(id, dto);
  }
}
