import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

/**
 * Contexte d'exécution minimal : seuls le `user` posé par `JwtAuthGuard` et
 * les métadonnées de rôle comptent pour ce guard.
 */
function contextWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;

  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('laisse passer un ADMIN sur une route ADMIN', () => {
    const guard = guardRequiring(['ADMIN']);

    expect(guard.canActivate(contextWith({ role: 'ADMIN' }))).toBe(true);
  });

  it('refuse un MANAGER sur une route ADMIN', () => {
    const guard = guardRequiring(['ADMIN']);

    expect(() => guard.canActivate(contextWith({ role: 'MANAGER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuse une requête sans utilisateur', () => {
    // Cas d'un oubli de `JwtAuthGuard` en amont : il doit produire un refus,
    // jamais un accès libre.
    const guard = guardRequiring(['ADMIN']);

    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('refuse un utilisateur sans rôle', () => {
    const guard = guardRequiring(['ADMIN']);

    expect(() => guard.canActivate(contextWith({}))).toThrow(
      ForbiddenException,
    );
  });

  it('ne dit pas quel rôle est attendu', () => {
    const guard = guardRequiring(['ADMIN']);

    try {
      guard.canActivate(contextWith({ role: 'MANAGER' }));
      throw new Error('aurait dû refuser');
    } catch (error) {
      // Annoncer « rôle ADMIN requis » confirmerait à un gérant curieux
      // l'existence d'une console d'administration.
      expect((error as Error).message).toBe('Accès refusé');
    }
  });

  it('ne bloque rien quand aucun rôle n’est exigé', () => {
    expect(guardRequiring(undefined).canActivate(contextWith(undefined))).toBe(
      true,
    );
    expect(guardRequiring([]).canActivate(contextWith(undefined))).toBe(true);
  });
});
