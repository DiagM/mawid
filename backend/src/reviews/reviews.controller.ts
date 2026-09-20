import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { TOKEN_THROTTLE } from '../common/throttling/throttle-config';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /api/reservations/token/:token/review
   * Depot d'un avis. Route publique, mais le token fait office de preuve de
   * passage : seul son porteur peut noter, et seulement un rendez-vous honore.
   */
  @Post('reservations/token/:token/review')
  @Throttle(TOKEN_THROTTLE)
  create(@Param('token') token: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createFromToken(token, dto);
  }

  /** GET /api/salons/:slug/reviews — avis publies d'un salon. */
  @Get('salons/:slug/reviews')
  findPublic(@Param('slug') slug: string) {
    return this.reviewsService.findPublicBySalonSlug(slug);
  }

  /**
   * GET /api/reviews/me
   * Avis recus par le salon du gerant. Lecture seule : un gerant qui pourrait
   * masquer ses mauvaises notes rendrait le systeme sans valeur.
   */
  @Get('reviews/me')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.findMine(user.id);
  }
}
