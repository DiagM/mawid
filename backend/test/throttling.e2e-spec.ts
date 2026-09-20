import request from 'supertest';
import type { App } from 'supertest/types';
import type { INestApplication } from '@nestjs/common';
import type { ThrottlerStorageService } from '@nestjs/throttler';
import type { PrismaService } from '../src/prisma/prisma.service';
import { createSalon, type SalonFixture } from './helpers/fixtures';

/**
 * ============================================
 * Limitation de débit
 * ============================================
 * `setup-e2e.ts` relève les plafonds pour toute la suite : sinon la 6e
 * connexion d'un fichier renverrait 429 et les tests échoueraient pour une
 * raison sans rapport avec ce qu'ils vérifient.
 *
 * Ce fichier fait l'inverse, pour lui seul : il rabaisse la limite avant de
 * construire SON application, et vérifie qu'elle s'applique vraiment. Sans
 * lui, retirer un `@Throttle` de `auth.controller.ts` ne casserait aucun
 * test — et un mot de passe faible tomberait en quelques minutes.
 *
 * D'où la construction manuelle de l'application plutôt que `createTestApp` :
 * les profils de rate limiting sont des constantes évaluées à l'import du
 * module, il faut donc régler l'environnement PUIS charger les modules.
 */
const AUTH_LIMIT = 3;

describe('Limitation de débit (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let resetDatabase: (prisma: PrismaService) => Promise<void>;
  let api: (path: string) => string;
  let salon: SalonFixture;
  /** Compteurs du throttler, à remettre à zéro entre deux scénarios. */
  let throttlerCounters: ThrottlerStorageService['storage'];

  beforeAll(async () => {
    process.env.THROTTLE_AUTH_LIMIT = String(AUTH_LIMIT);
    // Vide le cache de modules pour que `throttle-config` soit réévalué avec
    // la limite ci-dessus. Sans ça, `AppModule` garderait celle de la suite.
    jest.resetModules();

    // `jest.requireActual` et non `import()` : ts-jest compile vers CommonJS,
    // où un import dynamique exigerait `--experimental-vm-modules`.
    const helpers =
      jest.requireActual<typeof import('./helpers/app')>('./helpers/app');
    const ctx = await helpers.createTestApp();

    app = ctx.app;
    server = ctx.server;
    prisma = ctx.prisma;
    resetDatabase = helpers.resetDatabase;
    api = helpers.api;

    // Le compteur du throttler vit en mémoire et survit au nettoyage de la
    // base : sans cette remise à zéro, le premier scénario épuiserait le
    // quota et tous les suivants verraient des 429 non pertinents.
    // `requireActual` après le `resetModules` ci-dessus, sinon le jeton
    // d'injection ne serait pas celui qu'utilise l'application construite.
    const { ThrottlerStorage } =
      jest.requireActual<typeof import('@nestjs/throttler')>(
        '@nestjs/throttler',
      );
    throttlerCounters =
      app.get<ThrottlerStorageService>(ThrottlerStorage).storage;
  });

  afterAll(async () => {
    await app?.close();
    // Les fichiers de test partagent un seul processus (`maxWorkers: 1`) :
    // laisser cette variable en place imposerait une limite de 3 connexions
    // aux fichiers suivants.
    delete process.env.THROTTLE_AUTH_LIMIT;
  });

  beforeEach(async () => {
    throttlerCounters.clear();
    await resetDatabase(prisma);
    salon = await createSalon(prisma, {
      slug: 'salon-throttle',
      phone: '+213555600001',
    });
  });

  function login(password: string) {
    return request(server)
      .post(api('/auth/login'))
      .send({ phone: salon.phone, password });
  }

  it('bloque le bruteforce après quelques tentatives ratées', async () => {
    for (let attempt = 0; attempt < AUTH_LIMIT; attempt += 1) {
      await login('mauvaismotdepasse').expect(401);
    }

    // 429 et non 401 : la route ne compare même plus le mot de passe.
    await login('mauvaismotdepasse').expect(429);
  });

  it('compte aussi les tentatives réussies', async () => {
    // Un attaquant qui connaîtrait un mot de passe valide ne doit pas pouvoir
    // s'en servir pour remettre le compteur à zéro entre deux salves.
    for (let attempt = 0; attempt < AUTH_LIMIT; attempt += 1) {
      await login(salon.password).expect(200);
    }

    await login(salon.password).expect(429);
  });

  it('laisse la réservation publique respirer', async () => {
    // Le plafond de réservation est volontairement bien plus large : en
    // Algérie, les opérateurs mobiles partagent les IP publiques entre de
    // nombreux abonnés (CGNAT), donc une limite serrée par IP bloquerait de
    // vraies clientes. Ici, il reste au niveau réglé pour toute la suite.
    const responses = await Promise.all(
      Array.from({ length: AUTH_LIMIT + 2 }, () =>
        request(server).get(api(`/salons/${salon.slug}`)),
      ),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
  });
});
