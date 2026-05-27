import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activer CORS pour que le frontend (port 3000) puisse appeler le backend (port 3001)
  app.enableCors({
    origin: ['http://localhost:3000'],
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