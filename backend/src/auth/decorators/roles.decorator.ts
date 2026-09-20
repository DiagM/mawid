import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type AppRole = 'MANAGER' | 'ADMIN';

/**
 * Restreint une route à certains rôles.
 *
 * S'utilise TOUJOURS avec `JwtAuthGuard` en amont : sans utilisateur
 * authentifié, `RolesGuard` n'a rien à vérifier et refuse par défaut.
 *
 * ```ts
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * ```
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
