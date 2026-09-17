import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AUTH_THROTTLE } from '../common/throttling/throttle-config';
import { CurrentUser } from './decorators/current-user.decorator';
// Import "type-only" : ce type n'existe qu'à la compilation, jamais au runtime.
// Obligatoire car utilisé dans une signature décorée (@CurrentUser).
import type { AuthenticatedUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Connecte un gérant et renvoie un JWT.
   */
  @Post('login')
  // Sans cette limite, un mot de passe faible tombe en quelques minutes.
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK) // Force 200 au lieu du 201 par défaut sur POST
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /api/auth/me
   * Renvoie les infos du gérant connecté.
   * Route protégée : nécessite un JWT valide.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /**
   * PATCH /api/auth/password
   * Change le mot de passe du gérant connecté et lève `mustChangePassword`.
   * Limité comme le login : c'est une route qui vérifie un mot de passe, donc
   * une surface de bruteforce au même titre.
   */
  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_THROTTLE)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
