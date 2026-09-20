import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type AppRole } from '../decorators/roles.decorator';

/**
 * ============================================
 * Contrôle d'accès par rôle
 * ============================================
 * Complète `JwtAuthGuard`, qui répond « qui es-tu ? », par « as-tu le droit ? ».
 *
 * Deux choix de conception qui comptent :
 *
 * 1. **Refus par défaut.** Sans utilisateur sur la requête, on refuse — même
 *    si la route n'a pas déclaré de rôle. Oublier `JwtAuthGuard` devant
 *    `RolesGuard` doit produire un 403, jamais un accès libre.
 * 2. **Le rôle vient de la base, pas du JWT.** `JwtStrategy.validate` relit
 *    l'utilisateur à chaque requête : retirer le rôle ADMIN d'un compte prend
 *    effet immédiatement, sans attendre l'expiration de son token.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Aucune exigence déclarée : ce guard n'a rien à dire, la route reste
    // protégée par ce qui l'a décorée par ailleurs.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    const role = request.user?.role;

    if (!role || !required.includes(role as AppRole)) {
      // Message neutre : inutile d'annoncer à un gérant curieux qu'il existe
      // une console d'administration et quel rôle elle demande.
      throw new ForbiddenException('Accès refusé');
    }

    return true;
  }
}
