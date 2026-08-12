import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur custom pour récupérer le user authentifié depuis la requête.
 * Usage : myRoute(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Le user est attaché à request.user par JwtStrategy.validate.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    return request.user;
  },
);

/**
 * Type du user injecté par @CurrentUser.
 * Correspond au SELECT de JwtStrategy.validate.
 */
export interface AuthenticatedUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: 'MANAGER' | 'ADMIN';
}
