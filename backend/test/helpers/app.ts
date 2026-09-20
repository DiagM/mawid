import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { configureApp } from '../../src/app-setup';

/**
 * ============================================
 * Application de test bout en bout
 * ============================================
 * Ces tests tournent contre une **vraie base PostgreSQL**, pas contre des
 * doubles. C'est le seul moyen de vérifier ce qui compte le plus dans ce
 * produit et qu'aucun test unitaire ne peut couvrir : la contrainte
 * d'exclusion anti-double-réservation, qui vit en base et nulle part ailleurs.
 *
 * L'application est construite via `configureApp`, exactement comme en
 * production : sans cela, les tests passeraient sans `ValidationPipe` et
 * rateraient toutes les régressions de validation.
 */
export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  server: App;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer() as App,
  };
}

/**
 * Tables vidées entre deux scénarios.
 *
 * `TRUNCATE ... CASCADE` plutôt qu'une série de `deleteMany` : l'ordre des
 * suppressions devrait sinon suivre les clés étrangères, et chaque nouvelle
 * table obligerait à penser à l'insérer au bon endroit — une source d'échecs
 * intermittents difficiles à diagnostiquer.
 *
 * `_prisma_migrations` est évidemment exclue : la vider ferait croire à Prisma
 * que la base est vierge.
 */
const TRUNCATED_TABLES = [
  'reviews',
  'cash_movements',
  'stock_movements',
  'products',
  'reservation_prestations',
  'reservations',
  'clients',
  'blocked_slots',
  'employees',
  'prestations',
  'salons',
  'users',
];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase();

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TRUNCATED_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Dernier verrou avant un `TRUNCATE`.
 *
 * `setup-e2e.ts` vérifie déjà l'URL, mais cette fonction est exportée et
 * pourrait être appelée depuis un contexte où ce fichier n'a pas tourné. Une
 * base de développement effacée est irrécupérable : la vérification vaut sa
 * poignée de lignes.
 */
function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  const databaseName = url.split('/').pop()?.split('?')[0] ?? '';

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `resetDatabase() refuse de vider "${databaseName}" : seule une base ` +
        `dont le nom finit par "_test" peut être tronquée.`,
    );
  }
}

/** URL complète d'une route, préfixe `/api` compris. */
export function api(path: string): string {
  return `/api${path}`;
}

/**
 * Connecte un gérant et renvoie son JWT.
 *
 * Passe par la vraie route de login plutôt que de signer un token à la main :
 * un test qui fabriquerait son propre JWT ne remarquerait pas que
 * l'authentification est cassée.
 */
export async function loginAs(
  server: App,
  phone: string,
  password: string,
): Promise<string> {
  const response = await request(server)
    .post(api('/auth/login'))
    .send({ phone, password })
    .expect(200);

  return (response.body as { accessToken: string }).accessToken;
}

/** Ajoute l'en-tête d'authentification à une requête supertest. */
export function asManager<T extends { set: (k: string, v: string) => T }>(
  req: T,
  token: string,
): T {
  return req.set('Authorization', `Bearer ${token}`);
}
