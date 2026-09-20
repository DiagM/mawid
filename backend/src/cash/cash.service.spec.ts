import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CashService } from './cash.service';
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

function movement(type: 'SALE' | 'EXPENSE', amountCents: number) {
  return {
    id: `mov-${amountCents}`,
    type,
    amountCents,
    label: 'Test',
    method: 'CASH',
    occurredAt: new Date('2026-09-20T09:00:00.000Z'),
    employee: null,
    reservation: null,
  };
}

describe('CashService', () => {
  let service: CashService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    cashMovement: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    reservation: { findMany: jest.Mock; findUnique: jest.Mock };
    employee: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salon: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'salon-a', plan: 'PRO_PLUS' }),
      },
      cashMovement: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      employee: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CashService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CashService);
  });

  describe('journal du jour', () => {
    it('sépare recettes et dépenses', async () => {
      prisma.cashMovement.findMany.mockResolvedValue([
        movement('SALE', 80000),
        movement('SALE', 50000),
        movement('EXPENSE', 30000),
      ]);

      const result = await service.findDay('user-a', '2026-09-20');

      expect(result.salesCents).toBe(130000);
      expect(result.expensesCents).toBe(30000);
      expect(result.balanceCents).toBe(100000);
    });

    it('laisse le solde devenir négatif', async () => {
      // Une journée de gros achats sans vente est une information, pas une
      // anomalie à masquer.
      prisma.cashMovement.findMany.mockResolvedValue([
        movement('EXPENSE', 200000),
      ]);

      const result = await service.findDay('user-a', '2026-09-20');

      expect(result.balanceCents).toBe(-200000);
    });

    it('borne la requête à la journée locale demandée', async () => {
      await service.findDay('user-a', '2026-09-20');

      const query = firstArg<{
        where: { salonId: string; occurredAt: { gte: Date; lt: Date } };
      }>(prisma.cashMovement.findMany);

      expect(query.where.salonId).toBe('salon-a');
      // Minuit local à Alger = 23 h UTC la veille.
      expect(query.where.occurredAt.gte.toISOString()).toBe(
        '2026-09-19T23:00:00.000Z',
      );
      expect(query.where.occurredAt.lt.toISOString()).toBe(
        '2026-09-20T23:00:00.000Z',
      );
    });
  });

  describe('rendez-vous à encaisser', () => {
    it('ne propose que les honorés pas encore encaissés', async () => {
      // C'est ce qui évite la double saisie.
      await service.pendingReservations('user-a', '2026-09-20');

      const query = firstArg<{
        where: { status: string; cashMovement: unknown };
      }>(prisma.reservation.findMany);

      expect(query.where.status).toBe('HONORED');
      expect(query.where.cashMovement).toEqual({ is: null });
    });
  });

  describe('enregistrement', () => {
    it('refuse un rendez-vous appartenant à un autre salon', async () => {
      // Sans ce contrôle, un identifiant deviné permettrait d'attacher un
      // encaissement au rendez-vous d'un autre salon.
      prisma.reservation.findUnique.mockResolvedValue({
        salonId: 'salon-b',
        cashMovement: null,
      });

      await expect(
        service.create('user-a', {
          type: 'SALE',
          amountCents: 80000,
          label: 'Coupe',
          reservationId: 'res-du-salon-b',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cashMovement.create).not.toHaveBeenCalled();
    });

    it('refuse d’encaisser deux fois le même rendez-vous', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        salonId: 'salon-a',
        cashMovement: { id: 'deja' },
      });

      await expect(
        service.create('user-a', {
          type: 'SALE',
          amountCents: 80000,
          label: 'Coupe',
          reservationId: 'res-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('accepte une vente libre, sans rendez-vous', async () => {
      // Un salon encaisse aussi des clients de passage : ne compter que les
      // réservations Mawid donnerait un chiffre systématiquement faux.
      await service.create('user-a', {
        type: 'SALE',
        amountCents: 60000,
        label: 'Client de passage',
      });

      const create = firstArg<{
        data: { salonId: string; reservationId?: string; method: string };
      }>(prisma.cashMovement.create);

      expect(create.data.salonId).toBe('salon-a');
      expect(create.data.reservationId).toBeUndefined();
      // Espèces par défaut : l'écrasante majorité des paiements en salon.
      expect(create.data.method).toBe('CASH');
    });

    it('refuse un membre appartenant à un autre salon', async () => {
      prisma.employee.findUnique.mockResolvedValue({ salonId: 'salon-b' });

      await expect(
        service.create('user-a', {
          type: 'SALE',
          amountCents: 60000,
          label: 'Coupe',
          employeeId: 'emp-du-salon-b',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('suppression', () => {
    it("refuse un mouvement d'un autre salon", async () => {
      prisma.cashMovement.findUnique.mockResolvedValue({
        id: 'mov-b',
        salonId: 'salon-b',
      });

      await expect(service.remove('user-a', 'mov-b')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.cashMovement.delete).not.toHaveBeenCalled();
    });

    it('supprime réellement un mouvement de son salon', async () => {
      // Un journal de caisse qui garde les lignes fausses n'est plus un
      // journal de caisse.
      prisma.cashMovement.findUnique.mockResolvedValue({
        id: 'mov-1',
        salonId: 'salon-a',
      });

      await service.remove('user-a', 'mov-1');

      expect(prisma.cashMovement.delete).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
      });
    });
  });
});
