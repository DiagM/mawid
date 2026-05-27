import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard qui protège une route ou un controller.
 * Usage : @UseGuards(JwtAuthGuard) sur une méthode ou une classe.
 *
 * Vérifie automatiquement :
 *  - Présence du header Authorization
 *  - Signature du JWT valide
 *  - JWT non expiré
 *  - Utilisateur existe toujours en DB (via JwtStrategy.validate)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}