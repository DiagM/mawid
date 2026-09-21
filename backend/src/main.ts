import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';

/**
 * Nombre de proxys de confiance devant l'application.
 *
 * Express ne doit croire l'en-tête `X-Forwarded-For` que pour un nombre de
 * sauts CONNU. Mettre `trust proxy: true` en aveugle est un trou de sécurité :
 * n'importe qui peut alors forger cet en-tête et contourner entièrement le
 * rate limiting, puisque chaque requête semblerait venir d'une IP différente.
 *
 * Valeurs typiques : 0 en dev (accès direct), 1 derrière un reverse proxy
 * unique (Caddy, Render, Fly), 2 si Cloudflare proxifie en plus.
 * Voir docs/DEPLOYMENT.md.
 */
function resolveTrustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `TRUST_PROXY_HOPS doit être un entier positif ou nul (reçu : "${raw}")`,
    );
  }

  return parsed;
}

/**
 * Origines autorisées pour CORS.
 *
 * Lues dans `FRONTEND_ORIGINS` (liste séparée par des virgules). On retombe
 * sur localhost uniquement s'il n'y a rien de configuré : c'est confortable en
 * dev, mais une mise en production sans cette variable doit rester visible
 * plutôt que d'ouvrir silencieusement l'API à un domaine qui n'existe plus.
 */
function resolveCorsOrigins(): string[] {
  const raw = process.env.FRONTEND_ORIGINS?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FRONTEND_ORIGINS est obligatoire en production : sans elle, CORS ' +
          'resterait configuré sur http://localhost:3000.',
      );
    }
    return ['http://localhost:3000'];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sans ça, derrière un proxy, toutes les requêtes semblent venir de l'IP du
  // proxy : tous les clients partageraient le même compteur de rate limiting
  // et se bloqueraient mutuellement.
  const trustProxyHops = resolveTrustProxyHops();
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  // En-têtes de sécurité HTTP (nosniff, frameguard, HSTS, etc.).
  // L'API ne sert que du JSON : la CSP par défaut de helmet, pensée pour des
  // pages HTML, n'apporte rien ici et complique les outils de debug.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  // Préfixe /api et ValidationPipe, partagés avec les tests de bout en bout
  // pour qu'ils exercent exactement la même application.
  configureApp(app);

  // `PORT` d'abord : les hebergeurs (Render, Fly, Railway) imposent le port
  // qu'ils ont ouvert et declarent le deploiement en echec si rien n'ecoute
  // dessus — un service qui tourne mais sur le mauvais port est signale
  // « No open ports detected ». `BACKEND_PORT` reste pour docker-compose,
  // ou c'est nous qui choisissons.
  const port = process.env.PORT ?? process.env.BACKEND_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend Mawid démarré sur http://localhost:${port}/api`);
}

void bootstrap();
