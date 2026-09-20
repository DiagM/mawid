import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';

/** Réservation honorée d'un montant donné, en centimes. */
function honored(...prices: number[]) {
  return {
    status: 'HONORED',
    clientId: 'cli-1',
    employeeId: null,
    reservationPrestations: prices.map((priceCentsSnapshot) => ({
      priceCentsSnapshot,
    })),
  };
}

function withStatus(status: string) {
  return {
    status,
    clientId: 'cli-1',
    employeeId: null,
    reservationPrestations: [{ priceCentsSnapshot: 100000 }],
  };
}

describe('StatsService', () => {
  let service: StatsService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    reservation: { findMany: jest.Mock };
    reservationPrestation: { findMany: jest.Mock };
    employee: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salon: { findFirst: jest.fn().mockResolvedValue({ id: 'salon-a' }) },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
      reservationPrestation: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [StatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(StatsService);
  });

  describe("chiffre d'affaires", () => {
    it('ne compte que les rendez-vous honorés', async () => {
      // Un RDV confirmé n'a rien encaissé, un no-show rien du tout, une
      // annulation non plus. Seuls les passages réels comptent.
      prisma.reservation.findMany.mockResolvedValue([
        honored(80000),
        honored(50000),
        withStatus('CONFIRMED'),
        withStatus('NO_SHOW'),
        withStatus('CANCELED'),
      ]);

      const result = await service.forManager('user-a');

      expect(result.current.revenueCents).toBe(130000);
      expect(result.current.counts).toEqual({
        confirmed: 1,
        honored: 2,
        noShow: 1,
        canceled: 1,
        total: 5,
      });
    });

    it('additionne toutes les prestations d’un même rendez-vous', async () => {
      prisma.reservation.findMany.mockResolvedValue([honored(80000, 50000)]);

      const result = await service.forManager('user-a');

      expect(result.current.revenueCents).toBe(130000);
    });

    it('calcule le panier moyen sur les seuls honorés', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        honored(80000),
        honored(120000),
        withStatus('NO_SHOW'),
      ]);

      const result = await service.forManager('user-a');

      expect(result.current.averageBasketCents).toBe(100000);
    });

    it('renvoie null plutôt que zéro sans aucun passage', async () => {
      const result = await service.forManager('user-a');

      expect(result.current.averageBasketCents).toBeNull();
      expect(result.current.noShowRate).toBeNull();
    });
  });

  describe('taux de no-show', () => {
    it('exclut les annulations du dénominateur', async () => {
      // Annuler à l'avance est un comportement correct : le salon a le temps
      // de reprendre le créneau. Le mélanger aux absences brouillerait
      // l'indicateur.
      prisma.reservation.findMany.mockResolvedValue([
        withStatus('HONORED'),
        withStatus('HONORED'),
        withStatus('HONORED'),
        withStatus('NO_SHOW'),
        withStatus('CANCELED'),
        withStatus('CANCELED'),
      ]);

      const result = await service.forManager('user-a');

      // 1 absent sur 4 venus/attendus = 25 %, et non 1/6.
      expect(result.current.noShowRate).toBe(25);
    });

    it('arrondit au dixième de point', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        withStatus('HONORED'),
        withStatus('HONORED'),
        withStatus('NO_SHOW'),
      ]);

      const result = await service.forManager('user-a');

      expect(result.current.noShowRate).toBe(33.3);
    });
  });

  describe('comparaison', () => {
    it('interroge une période précédente de même durée', async () => {
      await service.forManager('user-a', '2026-09-10', '2026-09-19');

      const calls = prisma.reservation.findMany.mock.calls as {
        where: { startsAt: { gte: Date; lt: Date } };
      }[][];

      const current = calls[0][0].where.startsAt;
      const previous = calls[1][0].where.startsAt;

      const currentDuration = current.lt.getTime() - current.gte.getTime();
      const previousDuration = previous.lt.getTime() - previous.gte.getTime();

      // Comparer 10 jours à 30 jours n'apprendrait rien : la durée doit être
      // identique pour que l'écart ait un sens.
      expect(previousDuration).toBe(currentDuration);
      // La période précédente se termine là où la courante commence.
      expect(previous.lt.getTime()).toBe(current.gte.getTime());
    });

    it('refuse une fin antérieure au début', async () => {
      await expect(
        service.forManager('user-a', '2026-09-19', '2026-09-10'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('répartition par membre', () => {
    it('ne renvoie rien pour un salon sans équipe', async () => {
      // Une ligne « non assigné » n'apprendrait rien à un salon solo.
      const result = await service.forManager('user-a');

      expect(result.byEmployee).toEqual([]);
    });

    it('liste tous les membres, même ceux à zéro', async () => {
      // Un membre sans rendez-vous est une information en soi.
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', fullName: 'Sofiane' },
        { id: 'emp-2', fullName: 'Reda' },
      ]);
      prisma.reservation.findMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          clientId: 'cli-1',
          status: 'HONORED',
          reservationPrestations: [{ priceCentsSnapshot: 90000 }],
        },
      ]);

      const result = await service.forManager('user-a');

      expect(result.byEmployee).toEqual([
        { id: 'emp-1', fullName: 'Sofiane', count: 1, revenueCents: 90000 },
        { id: 'emp-2', fullName: 'Reda', count: 0, revenueCents: 0 },
      ]);
    });
  });

  describe('isolation', () => {
    it('scope par ownerId, jamais par un identifiant fourni', async () => {
      await service.forManager('user-a');

      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-a' } }),
      );

      const calls = prisma.reservation.findMany.mock.calls as {
        where: { salonId: string };
      }[][];
      expect(calls[0][0].where.salonId).toBe('salon-a');
    });

    it('refuse un gérant sans salon', async () => {
      prisma.salon.findFirst.mockResolvedValue(null);

      await expect(service.forManager('sans-salon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
