import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

const SALON_A = 'salon-a';
const GERANT_A = 'user-a';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    employee: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    reservation: { count: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let employeeCreate: jest.Mock;
  let reservationUpdateMany: jest.Mock;

  beforeEach(async () => {
    employeeCreate = jest.fn().mockResolvedValue({ id: 'emp-1' });
    reservationUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

    prisma = {
      salon: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: SALON_A, plan: 'PRO_PLUS' }),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: employeeCreate,
        update: jest.fn().mockResolvedValue({}),
      },
      reservation: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: reservationUpdateMany,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({
          employee: { create: employeeCreate },
          reservation: { updateMany: reservationUpdateMany },
        }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(EmployeesService);
  });

  describe('isolation entre salons', () => {
    it('ne liste que son équipe', async () => {
      await service.findMine(GERANT_A);

      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: GERANT_A } }),
      );
      const query = firstArg<{ where: { salonId: string } }>(
        prisma.employee.findMany,
      );
      expect(query.where.salonId).toBe(SALON_A);
    });

    it('rattache la création au salon déduit du JWT', async () => {
      await service.create(GERANT_A, { fullName: 'Sofiane' });

      const create = firstArg<{ data: { salonId: string } }>(employeeCreate);
      expect(create.data.salonId).toBe(SALON_A);
    });

    it('refuse au gérant A de modifier un membre du salon B', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-b',
        salon: { ownerId: 'user-b' },
      });

      await expect(
        service.update(GERANT_A, 'emp-b', { fullName: 'Pirate' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('refuse un membre inexistant', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update(GERANT_A, 'inconnu', { fullName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('création du premier employé', () => {
    it('réassigne les rendez-vous à venir non assignés', async () => {
      // Sans cette reprise, le salon se retrouverait avec des RDV à employeeId
      // null ET des RDV assignés : la contrainte d'exclusion, qui porte sur
      // COALESCE(employeeId, salonId), ne verrait pas le conflit entre les
      // deux, et deux clients pourraient se présenter au même moment.
      prisma.employee.count.mockResolvedValue(0);

      await service.create(GERANT_A, { fullName: 'Sofiane' });

      const update = firstArg<{
        where: {
          salonId: string;
          employeeId: null;
          status: string;
          startsAt: { gt: Date };
        };
        data: { employeeId: string };
      }>(reservationUpdateMany);

      expect(update.where.salonId).toBe(SALON_A);
      expect(update.where.employeeId).toBeNull();
      expect(update.where.status).toBe('CONFIRMED');
      expect(update.data.employeeId).toBe('emp-1');
    });

    it('ne touche PAS aux rendez-vous passés', async () => {
      // Réécrire l'historique fausserait les statistiques par employé, qui ne
      // sauraient rien de ces RDV antérieurs à l'existence de l'équipe.
      prisma.employee.count.mockResolvedValue(0);

      await service.create(GERANT_A, { fullName: 'Sofiane' });

      const update = firstArg<{ where: { startsAt: { gt: Date } } }>(
        reservationUpdateMany,
      );
      expect(update.where.startsAt.gt).toBeInstanceOf(Date);
    });

    it('ne réassigne rien quand une équipe existe déjà', async () => {
      prisma.employee.count.mockResolvedValue(2);

      await service.create(GERANT_A, { fullName: 'Troisième' });

      expect(reservationUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('archivage', () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        salon: { ownerId: GERANT_A },
      });
    });

    it('refuse tant que des rendez-vous à venir lui sont assignés', async () => {
      // Sinon ces clients se présenteraient face à personne.
      prisma.reservation.count.mockResolvedValue(3);

      await expect(service.archive(GERANT_A, 'emp-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('archive sans supprimer quand il n’a plus de rendez-vous', async () => {
      prisma.reservation.count.mockResolvedValue(0);

      await service.archive(GERANT_A, 'emp-1');

      const update = firstArg<{ data: { isActive: boolean } }>(
        prisma.employee.update,
      );
      // Soft delete : l'historique des rendez-vous doit rester lisible.
      expect(update.data.isActive).toBe(false);
    });
  });
});
