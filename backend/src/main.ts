import { NestFactory } from '@nestjs/core';
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

  const port = process.env.BACKEND_PORT ?? 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend Mawid démarré sur http://localhost:${port}/api`);
}

// Le "void" indique explicitement qu'on ignore la promesse retournée par bootstrap()
// (sinon ESLint râle avec @typescript-eslint/no-floating-promises)
void bootstrap();
