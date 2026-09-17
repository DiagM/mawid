import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: {
    user: { count: jest.Mock };
    salon: { count: jest.Mock };
  };

  beforeEach(async () => {
    // AppController dépend de Prisma depuis l'ajout de /health : on le
    // remplace par un double, ces tests n'ont pas besoin d'une vraie base.
    prisma = {
      user: { count: jest.fn().mockResolvedValue(3) },
      salon: { count: jest.fn().mockResolvedValue(1) },
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('répond sur la racine', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('remonte un état ok et les compteurs de la base', async () => {
      const result = await appController.health();

      expect(result.status).toBe('ok');
      expect(result.database).toEqual({
        connected: true,
        users: 3,
        salons: 1,
      });
    });

    it('laisse remonter une base injoignable plutôt que de mentir', async () => {
      // Un health check qui répond "ok" alors que la base est tombée est pire
      // qu'absent : il fait croire que tout va bien.
      prisma.user.count.mockRejectedValue(new Error('connexion refusée'));

      await expect(appController.health()).rejects.toThrow('connexion refusée');
    });
  });
});
