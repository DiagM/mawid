import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
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

const HONORED = {
  id: 'res-1',
  salonId: 'salon-a',
  clientId: 'cli-1',
  employeeId: 'emp-1',
  status: 'HONORED',
  review: null,
};

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    reservation: { findUnique: jest.Mock };
    salon: { findUnique: jest.Mock; findFirst: jest.Mock };
    review: {
      create: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      reservation: { findUnique: jest.fn().mockResolvedValue(HONORED) },
      salon: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'salon-a',
          isActive: true,
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'salon-a' }),
      },
      review: {
        create: jest.fn().mockResolvedValue({ id: 'rev-1', rating: 5 }),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { rating: null },
          _count: { _all: 0 },
        }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ReviewsService);
  });

  describe('dépôt via token — le verrou anti-abus', () => {
    it('accepte un avis sur un rendez-vous honoré', async () => {
      await service.createFromToken('tok-1', { rating: 5 });

      const create = firstArg<{
        data: { salonId: string; reservationId: string; employeeId: string };
      }>(prisma.review.create);
      // Salon, réservation, client et employé sont tous déduits du token :
      // le client ne peut noter que SON passage.
      expect(create.data.salonId).toBe('salon-a');
      expect(create.data.reservationId).toBe('res-1');
      expect(create.data.employeeId).toBe('emp-1');
    });

    it('refuse un rendez-vous pas encore honoré', async () => {
      // Sans cette règle, n'importe qui pourrait noter un salon dès la
      // réservation, sans y être allé.
      prisma.reservation.findUnique.mockResolvedValue({
        ...HONORED,
        status: 'CONFIRMED',
      });

      await expect(
        service.createFromToken('tok-1', { rating: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('refuse un rendez-vous annulé', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...HONORED,
        status: 'CANCELED',
      });

      await expect(
        service.createFromToken('tok-1', { rating: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un client qui ne s’est pas présenté', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...HONORED,
        status: 'NO_SHOW',
      });

      await expect(
        service.createFromToken('tok-1', { rating: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un second avis sur le même passage', async () => {
      // Un passage, un avis : c'est ce qui empêche de noyer un salon sous
      // dix avis depuis une seule réservation.
      prisma.reservation.findUnique.mockResolvedValue({
        ...HONORED,
        review: { id: 'rev-existant' },
      });

      await expect(
        service.createFromToken('tok-1', { rating: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('refuse un token inconnu', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(
        service.createFromToken('inconnu', { rating: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('affichage public', () => {
    it('ne montre que les avis publiés', async () => {
      await service.findPublicBySalonSlug('karim-barber');

      const query = firstArg<{
        where: { salonId: string; isPublished: boolean };
      }>(prisma.review.findMany);
      expect(query.where.isPublished).toBe(true);
      expect(query.where.salonId).toBe('salon-a');
    });

    it('refuse un salon désactivé', async () => {
      prisma.salon.findUnique.mockResolvedValue({
        id: 'salon-a',
        isActive: false,
      });

      await expect(
        service.findPublicBySalonSlug('karim-barber'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('signe l’avis avec le prénom figé sur la réservation', async () => {
      // Le snapshot, pas la fiche client : corriger une fiche ne doit pas
      // réécrire la signature d'un avis déjà publié.
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'rev-1',
          rating: 5,
          comment: 'Parfait',
          createdAt: new Date('2026-09-20T10:00:00.000Z'),
          reservation: { clientFirstName: 'Amine' },
          employee: { fullName: 'Sofiane' },
        },
      ]);

      const result = await service.findPublicBySalonSlug('karim-barber');

      expect(result.items[0].clientFirstName).toBe('Amine');
      expect(result.items[0].employeeName).toBe('Sofiane');
    });
  });

  describe('moyenne', () => {
    it('arrondit au dixième', async () => {
      // « 4,3 » se lit, « 4,333333 » non.
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.333333 },
        _count: { _all: 3 },
      });

      const summary = await service.summaryForSalon('salon-a');

      expect(summary.average).toBe(4.3);
      expect(summary.count).toBe(3);
    });

    it('renvoie null sans aucun avis, pas zéro', async () => {
      // Afficher « 0/5 » pour un salon sans avis le pénaliserait injustement.
      const summary = await service.summaryForSalon('salon-a');

      expect(summary.average).toBeNull();
      expect(summary.count).toBe(0);
    });

    it('regroupe plusieurs salons en une seule requête', async () => {
      // Un agrégat par salon produirait N+1 requêtes sur une page de résultats.
      prisma.review.groupBy.mockResolvedValue([
        { salonId: 'salon-a', _avg: { rating: 5 }, _count: { _all: 2 } },
      ]);

      const map = await service.summariesForSalons(['salon-a', 'salon-b']);

      expect(prisma.review.groupBy).toHaveBeenCalledTimes(1);
      expect(map.get('salon-a')).toEqual({ average: 5, count: 2 });
      expect(map.get('salon-b')).toBeUndefined();
    });

    it("n'interroge pas la base pour une liste vide", async () => {
      const map = await service.summariesForSalons([]);

      expect(prisma.review.groupBy).not.toHaveBeenCalled();
      expect(map.size).toBe(0);
    });
  });

  describe('vue gérant', () => {
    it('montre aussi les avis non publiés, en lecture seule', async () => {
      await service.findMine('user-a');

      const query = firstArg<{ where: { salonId: string } }>(
        prisma.review.findMany,
      );
      // Pas de filtre isPublished : le gérant voit tout ce qui le concerne.
      expect(query.where).toEqual({ salonId: 'salon-a' });
    });

    it('scope par ownerId, jamais par un identifiant fourni', async () => {
      await service.findMine('user-a');

      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-a' } }),
      );
    });

    it('refuse un gérant sans salon', async () => {
      prisma.salon.findFirst.mockResolvedValue(null);

      await expect(service.findMine('sans-salon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
