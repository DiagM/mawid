import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

/**
 * ============================================
 * Configuration commune de l'application
 * ============================================
 * Partagée par `main.ts` et par les tests de bout en bout.
 *
 * Ce n'est pas de la factorisation gratuite : si les tests E2E construisaient
 * leur propre application, ils tourneraient **sans** le `ValidationPipe` ni le
 * préfixe `/api`. Ils passeraient donc au vert sur des requêtes que la vraie
 * application refuserait, et rateraient précisément les régressions de
 * validation qu'on leur demande de surveiller.
 */
export function configureApp(app: INestApplication): void {
  // Préfixe global /api pour toutes les routes (ex: /api/salons)
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // Refuse les requêtes avec des champs inconnus
      transform: true, // Convertit les types primitifs auto (string → number)
    }),
  );
}
