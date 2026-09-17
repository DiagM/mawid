import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule);

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

  // Préfixe global /api pour toutes les routes (ex: /api/salons)
  app.setGlobalPrefix('api');

  // Validation automatique de tous les DTOs avec class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // Refuse les requêtes avec des champs inconnus
      transform: true, // Convertit les types primitifs auto (string → number)
    }),
  );

  const port = process.env.BACKEND_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend Mawid démarré sur http://localhost:${port}/api`);
}

void bootstrap();
