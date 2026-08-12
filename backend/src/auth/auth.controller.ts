import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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
}
