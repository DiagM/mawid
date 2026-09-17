import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BlockedSlotsService } from './blocked-slots.service';
import { PrismaService } from '../prisma/prisma.service';

const SALON_A = 'salon-a';
const SALON_B = 'salon-b';
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

describe('BlockedSlotsService', () => {
  let service: BlockedSlotsService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    blockedSlot: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    reservation: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salon: { findFirst: jest.fn().mockResolvedValue({ id: SALON_A }) },
      blockedSlot: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'blk-1',
          startsAt: new Date('2026-10-05T11:00:00.000Z'),
          endsAt: new Date('2026-10-05T12:00:00.000Z'),
          reason: 'Pause déjeuner',
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      reservation: { count: jest.fn().mockResolvedValue(0) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BlockedSlotsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(BlockedSlotsService);
  });

  const validDto = {
    startsAt: '2026-10-05T11:00:00.000Z',
    endsAt: '2026-10-05T12:00:00.000Z',
    reason: 'Pause déjeuner',
  };

  describe('isolation entre salons', () => {
    it('ne liste que les créneaux du salon du gérant', async () => {
      await service.findMine(GERANT_A);

      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: GERANT_A } }),
      );
      const query = firstArg<{ where: { salonId: string } }>(
        prisma.blockedSlot.findMany,
      );
      expect(query.where.salonId).toBe(SALON_A);
    });

    it('rattache toujours la création au salon déduit du JWT', async () => {
      await service.create(GERANT_A, validDto);

      const write = firstArg<{ data: { salonId: string } }>(
        prisma.blockedSlot.create,
      );
      expect(write.data.salonId).toBe(SALON_A);
    });

    it('refuse au gérant A de supprimer un créneau du salon B', async () => {
      prisma.blockedSlot.findUnique.mockResolvedValue({
        id: 'blk-du-salon-b',
        salonId: SALON_B,
      });

      await expect(
        service.remove(GERANT_A, 'blk-du-salon-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.blockedSlot.delete).not.toHaveBeenCalled();
    });

    it('autorise la suppression sur son propre salon', async () => {
      prisma.blockedSlot.findUnique.mockResolvedValue({
        id: 'blk-1',
        salonId: SALON_A,
      });

      await service.remove(GERANT_A, 'blk-1');

      expect(prisma.blockedSlot.delete).toHaveBeenCalledWith({
        where: { id: 'blk-1' },
      });
    });

    it('refuse un gérant sans salon', async () => {
      prisma.salon.findFirst.mockResolvedValue(null);

      await expect(service.findMine('user-sans-salon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('validation métier', () => {
    it('refuse une fin antérieure au début', async () => {
      await expect(
        service.create(GERANT_A, {
          startsAt: '2026-10-05T12:00:00.000Z',
          endsAt: '2026-10-05T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un blocage de plus de 30 jours', async () => {
      await expect(
        service.create(GERANT_A, {
          startsAt: '2026-10-05T11:00:00.000Z',
          endsAt: '2026-12-05T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse de bloquer une période contenant des RDV confirmés', async () => {
      // Sinon le client garde un RDV que le salon croit indisponible.
      prisma.reservation.count.mockResolvedValue(2);

      await expect(service.create(GERANT_A, validDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.blockedSlot.create).not.toHaveBeenCalled();
    });

    it('ne compte que les RDV confirmés du bon salon', async () => {
      await service.create(GERANT_A, validDto);

      const query = firstArg<{
        where: { salonId: string; status: string };
      }>(prisma.reservation.count);
      expect(query.where.salonId).toBe(SALON_A);
      expect(query.where.status).toBe('CONFIRMED');
    });
  });
});
