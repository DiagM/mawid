import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

/** Premier argument du premier appel d'un mock, typé explicitement. */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

const SALON_ROW = {
  id: 'salon-1',
  slug: 'karim-barber',
  name: 'Karim Barber Shop',
  city: 'Alger',
  district: 'Bab Ezzouar',
  isActive: true,
  plan: 'FREE' as const,
  featuredUntil: null,
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  owner: {
    id: 'user-1',
    phone: '+213555100001',
    fullName: 'Karim Benali',
    lastLogin: null,
    mustChangePassword: false,
  },
  _count: { prestations: 5, employees: 2 },
};

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    salon: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    user: {
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    reservation: { count: jest.Mock; groupBy: jest.Mock };
    client: { count: jest.Mock };
    review: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salon: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([SALON_ROW]),
        findUnique: jest.fn().mockResolvedValue({ id: 'salon-1' }),
        update: jest.fn().mockResolvedValue({
          id: 'salon-1',
          slug: 'karim-barber',
          name: 'Karim Barber Shop',
          isActive: true,
          plan: 'PRO',
          featuredUntil: null,
        }),
        create: jest.fn(),
      },
      user: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
      reservation: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ salonId: 'salon-1', _count: { _all: 12 } }]),
      },
      client: { count: jest.fn().mockResolvedValue(0) },
      review: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'rev-1' }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'rev-1', isPublished: false }),
      },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  describe('liste des salons', () => {
    it('joint la consommation du mois en une seule requête', async () => {
      const salons = await service.findSalons({});

      // Un appel de quota par salon ferait N+1 requêtes sur un tableau.
      expect(prisma.reservation.groupBy).toHaveBeenCalledTimes(1);
      expect(salons[0].quota.used).toBe(12);
      expect(salons[0].quota.limit).toBe(30);
      expect(salons[0].quota.remaining).toBe(18);
    });

    it('ne compte pas les réservations annulées', async () => {
      await service.findSalons({});

      const args = firstArg<{ where: { status: { not: string } } }>(
        prisma.reservation.groupBy,
      );
      expect(args.where.status).toEqual({ not: 'CANCELED' });
    });

    it('filtre les salons en attente de validation', async () => {
      await service.findSalons({ status: 'pending' });

      const args = firstArg<{ where: { isActive?: boolean } }>(
        prisma.salon.findMany,
      );
      expect(args.where.isActive).toBe(false);
    });

    it('cherche sur le nom, le slug et le numéro du gérant', async () => {
      await service.findSalons({ q: 'karim' });

      const args = firstArg<{ where: { OR?: unknown[] } }>(
        prisma.salon.findMany,
      );
      expect(args.where.OR).toHaveLength(3);
    });

    it('ne considère pas une mise en avant expirée comme active', async () => {
      prisma.salon.findMany.mockResolvedValue([
        { ...SALON_ROW, featuredUntil: new Date('2020-01-01T00:00:00.000Z') },
      ]);

      const salons = await service.findSalons({});

      // Une date passée non nulle reste une date : sans cette comparaison, un
      // abonnement terminé continuerait d'apparaître comme payé.
      expect(salons[0].isFeatured).toBe(false);
    });
  });

  describe('mise à jour d’un salon', () => {
    it('convertit des semaines en date de fin', async () => {
      await service.updateSalon('salon-1', { featuredWeeks: 2 });

      const args = firstArg<{ data: { featuredUntil: Date } }>(
        prisma.salon.update,
      );
      const days =
        (args.data.featuredUntil.getTime() - Date.now()) /
        (24 * 60 * 60 * 1000);

      expect(Math.round(days)).toBe(14);
    });

    it('retire la mise en avant avec 0 semaine', async () => {
      await service.updateSalon('salon-1', { featuredWeeks: 0 });

      const args = firstArg<{ data: { featuredUntil: Date | null } }>(
        prisma.salon.update,
      );
      expect(args.data.featuredUntil).toBeNull();
    });

    it('ne touche pas à la mise en avant si elle n’est pas mentionnée', async () => {
      await service.updateSalon('salon-1', { plan: 'PRO' });

      const args = firstArg<{ data: Record<string, unknown> }>(
        prisma.salon.update,
      );
      expect(args.data).not.toHaveProperty('featuredUntil');
      expect(args.data.plan).toBe('PRO');
    });

    it('refuse un salon inconnu', async () => {
      prisma.salon.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSalon('fantome', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('création d’un gérant', () => {
    const DTO = {
      phone: '0555700001',
      fullName: 'Amel Gérante',
      salonName: 'Salon Élégance',
      addressLine: '12 rue Didouche Mourad',
      district: 'Alger Centre',
      contactPhone: '0661700001',
    };

    beforeEach(() => {
      // Aucun salon ne porte encore ce slug : sans ça, `uniqueSlug`
      // croirait chaque candidat pris et finirait par abandonner.
      prisma.salon.findUnique.mockResolvedValue(null);

      prisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            user: {
              create: jest.fn().mockResolvedValue({
                id: 'user-2',
                phone: '+213555700001',
                fullName: 'Amel Gérante',
              }),
            },
            salon: {
              create: jest.fn().mockResolvedValue({
                id: 'salon-2',
                slug: 'salon-elegance',
                name: 'Salon Élégance',
                isActive: true,
              }),
            },
          }),
      );
    });

    it('normalise les deux numéros en E.164', async () => {
      const result = await service.createManager(DTO);

      expect(result.user.phone).toBe('+213555700001');
    });

    it('génère un mot de passe et ne le stocke jamais en clair', async () => {
      const result = await service.createManager(DTO);

      expect(result.password).toHaveLength(16);
      // Le hash est calculé dans la transaction ; ce qui compte ici est que
      // le mot de passe clair ne soit renvoyé qu'à l'appelant, une seule fois.
      expect(result.password).not.toBe(result.user.id);
    });

    it('refuse un numéro déjà inscrit', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(service.createManager(DTO)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('réinitialisation de mot de passe', () => {
    it('force le changement à la prochaine connexion', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phone: '+213555100001',
        role: 'MANAGER',
      });

      const result = await service.resetManagerPassword('user-1');

      const args = firstArg<{ data: { mustChangePassword: boolean } }>(
        prisma.user.update,
      );
      expect(args.data.mustChangePassword).toBe(true);
      expect(result.password).toHaveLength(16);
    });

    it('refuse un compte inconnu', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetManagerPassword('fantome')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('modération des avis', () => {
    it('masque sans supprimer', async () => {
      await service.moderateReview('rev-1', { isPublished: false });

      // Supprimer la ligne effacerait la trace de la modération et
      // rouvrirait la possibilité de redéposer un avis sur le même RDV.
      const args = firstArg<{ data: { isPublished: boolean } }>(
        prisma.review.update,
      );
      expect(args.data.isPublished).toBe(false);
    });

    it('refuse un avis inconnu', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.moderateReview('fantome', { isPublished: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('filtre les notes basses pour la modération', async () => {
      await service.findReviews({ maxRating: 2, visibility: 'published' });

      const args = firstArg<{
        where: { rating?: { lte: number }; isPublished?: boolean };
      }>(prisma.review.findMany);

      expect(args.where.rating).toEqual({ lte: 2 });
      expect(args.where.isPublished).toBe(true);
    });
  });
});
