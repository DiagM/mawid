import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

describe('StockService', () => {
  let service: StockService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    product: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    stockMovement: { findMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let productCreate: jest.Mock;
  let productUpdate: jest.Mock;
  let movementCreate: jest.Mock;

  beforeEach(async () => {
    productCreate = jest.fn().mockResolvedValue({ id: 'prod-1', quantity: 0 });
    productUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'prod-1', name: 'Shampoing', quantity: 5 });
    movementCreate = jest.fn().mockResolvedValue({ id: 'mov-1' });

    prisma = {
      salon: { findFirst: jest.fn().mockResolvedValue({ id: 'salon-a' }) },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'prod-1',
          quantity: 10,
          salon: { ownerId: 'user-a' },
        }),
        create: productCreate,
        update: productUpdate,
      },
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: movementCreate,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          product: { create: productCreate, update: productUpdate },
          stockMovement: { create: movementCreate },
        }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [StockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(StockService);
  });

  describe('alerte de seuil', () => {
    it('signale un produit au niveau du seuil ou en dessous', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Bas',
          quantity: 2,
          lowStockThreshold: 3,
          isActive: true,
          unit: null,
          costCents: null,
        },
        {
          id: 'p2',
          name: 'Pile',
          quantity: 3,
          lowStockThreshold: 3,
          isActive: true,
          unit: null,
          costCents: null,
        },
        {
          id: 'p3',
          name: 'Haut',
          quantity: 4,
          lowStockThreshold: 3,
          isActive: true,
          unit: null,
          costCents: null,
        },
      ]);

      const result = await service.findMine('user-a');

      expect(result.map((product) => product.isLowStock)).toEqual([
        true,
        true,
        false,
      ]);
    });

    it("n'alerte pas sur un produit archivé", async () => {
      // Un produit qu'on ne vend plus n'a pas à être réapprovisionné.
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Archive',
          quantity: 0,
          lowStockThreshold: 5,
          isActive: false,
          unit: null,
          costCents: null,
        },
      ]);

      const result = await service.findMine('user-a');

      expect(result[0].isLowStock).toBe(false);
    });
  });

  describe('mouvements de stock', () => {
    it('écrit le mouvement ET la quantité dans la même transaction', async () => {
      // Un mouvement sans mise à jour de quantité (ou l'inverse) laisserait
      // le stock affiché et son historique en désaccord, sans moyen de
      // savoir lequel a raison.
      await service.move('user-a', 'prod-1', { delta: -3 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(movementCreate).toHaveBeenCalledTimes(1);
      const update = firstArg<{ data: { quantity: number } }>(productUpdate);
      expect(update.data.quantity).toBe(7);
    });

    it('refuse un mouvement qui rendrait le stock négatif', async () => {
      // Un stock négatif n'existe pas physiquement : l'accepter masquerait
      // le vrai problème de saisie.
      await expect(
        service.move('user-a', 'prod-1', { delta: -11 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('autorise une sortie qui tombe pile à zéro', async () => {
      await service.move('user-a', 'prod-1', { delta: -10 });

      const update = firstArg<{ data: { quantity: number } }>(productUpdate);
      expect(update.data.quantity).toBe(0);
    });

    it('refuse un mouvement nul', async () => {
      await expect(
        service.move('user-a', 'prod-1', { delta: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('création', () => {
    it('enregistre le stock initial comme un mouvement', async () => {
      // Sans cette ligne, l'historique commencerait par un trou inexpliqué.
      productCreate.mockResolvedValue({ id: 'prod-1', quantity: 12 });

      await service.create('user-a', { name: 'Shampoing', quantity: 12 });

      const movement = firstArg<{ data: { delta: number; reason: string } }>(
        movementCreate,
      );
      expect(movement.data.delta).toBe(12);
      expect(movement.data.reason).toBe('Stock initial');
    });

    it("n'enregistre aucun mouvement pour un stock initial nul", async () => {
      productCreate.mockResolvedValue({ id: 'prod-1', quantity: 0 });

      await service.create('user-a', { name: 'Shampoing' });

      expect(movementCreate).not.toHaveBeenCalled();
    });

    it('rattache le produit au salon déduit du JWT', async () => {
      await service.create('user-a', { name: 'Shampoing' });

      const create = firstArg<{ data: { salonId: string } }>(productCreate);
      expect(create.data.salonId).toBe('salon-a');
    });
  });

  describe('modification', () => {
    it('ne laisse PAS modifier la quantité directement', async () => {
      // La quantité ne change que par un mouvement, qui en porte la raison
      // et la date. L'éditer en direct rendrait l'historique faux sans
      // prévenir.
      await service.update('user-a', 'prod-1', {
        name: 'Nouveau nom',
        lowStockThreshold: 5,
      });

      const update = firstArg<{ data: Record<string, unknown> }>(productUpdate);
      expect(update.data.quantity).toBeUndefined();
      expect(update.data.name).toBe('Nouveau nom');
    });
  });

  describe('isolation entre salons', () => {
    it('refuse au gérant A un produit du salon B', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-b',
        quantity: 5,
        salon: { ownerId: 'user-b' },
      });

      await expect(
        service.move('user-a', 'prod-b', { delta: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ne liste que les produits de son salon', async () => {
      await service.findMine('user-a');

      const query = firstArg<{ where: { salonId: string } }>(
        prisma.product.findMany,
      );
      expect(query.where.salonId).toBe('salon-a');
    });

    it('refuse un produit inexistant', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.move('user-a', 'inconnu', { delta: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
