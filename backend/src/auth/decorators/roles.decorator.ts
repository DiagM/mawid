import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour restreindre une route à certains rôles (ex: @Roles('ADMIN')).
 * Doit être combiné avec RolesGuard, lui-même exécuté APRÈS JwtAuthGuard
 * (qui peuple request.user) : @UseGuards(JwtAuthGuard, RolesGuard).
 */
export const Roles = (...roles: Array<'MANAGER' | 'ADMIN'>) =>
  SetMetadata(ROLES_KEY, roles);
