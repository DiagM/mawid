import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SalonsService } from './salons.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService } from '../reviews/reviews.service';
import { MapsLinkService } from './maps-link.service';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

interface SearchWhere {
  isActive: boolean;
  city?: string;
  isWomenOnly?: boolean;
  OR?: unknown[];
}

describe('SalonsService', () => {
  let service: SalonsService;
  let prisma: {
    salon: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let mapsLink: { resolve: jest.Mock };

  beforeEach(async () => {
    prisma = {
      salon: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    mapsLink = { resolve: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SalonsService,
        { provide: PrismaService, useValue: prisma },
        // Les notes sont agrégées par ReviewsService : on le double ici, ces
        // tests portent sur la recherche et le scoping, pas sur la notation.
        {
          provide: ReviewsService,
          useValue: {
            summaryForSalon: jest
              .fn()
              .mockResolvedValue({ average: null, count: 0 }),
            summariesForSalons: jest.fn().mockResolvedValue(new Map()),
          },
        },
        // Double : la resolution d'un lien Maps fait une requete reseau,
        // testee separement dans maps-link.service.spec.ts. Ici on veut
        // seulement pouvoir piloter son verdict.
        { provide: MapsLinkService, useValue: mapsLink },
      ],
    }).compile();

    service = moduleRef.get(SalonsService);
  });

  describe('recherche publique', () => {
    it('ne renvoie jamais que des salons actifs', async () => {
      await service.search({});

      const query = firstArg<{ where: SearchWhere }>(prisma.salon.findMany);
      // Un salon désactivé, ou créé par onboarding self-service et pas encore
      // validé, ne doit apparaître dans aucun résultat.
      expect(query.where.isActive).toBe(true);
    });

    it('filtre par ville quand elle est fournie', async () => {
      await service.search({ city: 'Alger' });

      const query = firstArg<{ where: SearchWhere }>(prisma.salon.findMany);
      expect(query.where.city).toBe('Alger');
    });

    it('applique le filtre 100 % féminin', async () => {
      await service.search({ womenOnly: true });

      const query = firstArg<{ where: SearchWhere }>(prisma.salon.findMany);
      expect(query.where.isWomenOnly).toBe(true);
    });

    it('cherche aussi dans les prestations, pas seulement le nom du salon', async () => {
      // Un client tape « barbe » bien plus souvent que le nom d'un salon
      // qu'il ne connaît pas encore.
      prisma.$queryRaw.mockResolvedValue([{ id: 'salon-a' }]);

      await service.search({ q: 'barbe' });

      const sql = JSON.stringify(prisma.$queryRaw.mock.calls[0]);
      expect(sql).toContain('prestations');
      // unaccent est indispensable : sans lui « epilation » ne trouverait
      // jamais « Épilation », et la recherche paraîtrait cassée.
      expect(sql).toContain('unaccent');
    });

    it('restreint aux identifiants trouvés par la correspondance textuelle', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'salon-a' },
        { id: 'salon-c' },
      ]);

      await service.search({ q: 'barbe' });

      const query = firstArg<{
        where: SearchWhere & { id?: { in: string[] } };
      }>(prisma.salon.findMany);
      expect(query.where.id?.in).toEqual(['salon-a', 'salon-c']);
      // Le filtre isActive reste appliqué en plus de la correspondance.
      expect(query.where.isActive).toBe(true);
    });

    it('neutralise les métacaractères LIKE', async () => {
      // Sans échappement, un client tapant « % » listerait tous les salons.
      prisma.$queryRaw.mockResolvedValue([]);

      await service.search({ q: '100%' });

      // calls[0] = [tableau du template, puis chaque valeur interpolée].
      const call = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(call[1]).toBe('%100\\%%');
    });

    it("n'interroge pas la base textuellement sans terme de recherche", async () => {
      await service.search({ city: 'Alger' });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("n'expose aucun champ interne", async () => {
      await service.search({});

      const query = firstArg<{ select: Record<string, unknown> }>(
        prisma.salon.findMany,
      );
      // Le select est explicite : ownerId, isActive et les coordonnées
      // internes ne doivent pas fuiter sur une route publique.
      expect(query.select.ownerId).toBeUndefined();
      expect(query.select.plan).toBeUndefined();
      expect(query.select.contactPhone).toBeUndefined();
    });

    it('borne la pagination par défaut', async () => {
      await service.search({});

      const query = firstArg<{ take: number; skip: number }>(
        prisma.salon.findMany,
      );
      expect(query.take).toBe(20);
      expect(query.skip).toBe(0);
    });

    it("expose un prix d'appel plutôt que tout le catalogue", async () => {
      prisma.salon.findMany.mockResolvedValue([
        {
          slug: 'karim-barber',
          name: 'Karim Barber',
          district: 'Bab Ezzouar',
          city: 'Alger',
          isWomenOnly: false,
          photos: [],
          prestations: [{ priceCents: 50000 }],
        },
      ]);
      prisma.salon.count.mockResolvedValue(1);

      const result = await service.search({});

      expect(result.items[0].fromPriceCents).toBe(50000);
      expect(result.items[0].photo).toBeNull();
      expect(result.total).toBe(1);
    });
  });

  describe('mise en avant payante', () => {
    it('sépare les mis en avant sur la date du jour, pas sur la présence d’une date', async () => {
      // Un simple orderBy featuredUntil desc serait FAUX : une date expirée
      // reste une date non nulle, donc un salon qui a cessé de payer
      // continuerait de passer devant les autres.
      await service.search({});

      const calls = prisma.salon.findMany.mock.calls as {
        where: { featuredUntil?: unknown; OR?: unknown[] };
      }[][];

      const featuredCall = calls.find((call) => call[0].where.featuredUntil);
      expect(featuredCall?.[0].where.featuredUntil).toHaveProperty('gt');
    });

    it('exclut les mises en avant expirées de la population prioritaire', async () => {
      await service.search({});

      const calls = prisma.salon.findMany.mock.calls as {
        where: { OR?: { featuredUntil?: unknown }[] };
      }[][];

      // La seconde requête regroupe « jamais mis en avant » et « expiré ».
      const regularCall = calls.find((call) =>
        call[0].where.OR?.some((clause) => clause.featuredUntil === null),
      );
      expect(regularCall).toBeDefined();
    });

    it('ne signale pas une mise en avant expirée', async () => {
      prisma.salon.findMany.mockResolvedValue([
        {
          id: 'salon-a',
          slug: 'karim-barber',
          name: 'Karim Barber',
          district: 'Bab Ezzouar',
          city: 'Alger',
          isWomenOnly: false,
          photos: [],
          featuredUntil: new Date('2020-01-01T00:00:00.000Z'),
          prestations: [],
        },
      ]);
      prisma.salon.count.mockResolvedValue(1);

      const result = await service.search({});

      expect(result.items[0].isFeatured).toBe(false);
    });

    it('signale une mise en avant en cours', async () => {
      prisma.salon.findMany.mockResolvedValue([
        {
          id: 'salon-a',
          slug: 'karim-barber',
          name: 'Karim Barber',
          district: 'Bab Ezzouar',
          city: 'Alger',
          isWomenOnly: false,
          photos: [],
          featuredUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          prestations: [],
        },
      ]);
      prisma.salon.count.mockResolvedValue(1);

      const result = await service.search({});

      expect(result.items[0].isFeatured).toBe(true);
    });
  });

  describe('fiche publique', () => {
    it('expose le numéro public et le filtre féminin', async () => {
      prisma.salon.findUnique.mockResolvedValue({
        id: 'salon-a',
        isActive: true,
        prestations: [],
      });

      await service.findPublicBySlug('karim-barber');

      const query = firstArg<{ select: Record<string, unknown> }>(
        prisma.salon.findUnique,
      );
      // Sans contactPhone, le lien wa.me de confirmation et les données
      // structurées de la fiche sont vides — toute la stratégie de
      // notification gratuite en dépend.
      expect(query.select.contactPhone).toBe(true);
      expect(query.select.isWomenOnly).toBe(true);
    });

    it("n'expose pas le propriétaire ni le plan", async () => {
      prisma.salon.findUnique.mockResolvedValue({
        id: 'salon-a',
        isActive: true,
        prestations: [],
      });

      await service.findPublicBySlug('karim-barber');

      const query = firstArg<{ select: Record<string, unknown> }>(
        prisma.salon.findUnique,
      );
      expect(query.select.ownerId).toBeUndefined();
      expect(query.select.plan).toBeUndefined();
    });

    it('refuse un salon désactivé comme introuvable', async () => {
      // Même réponse qu'un slug inexistant : inutile de révéler qu'un salon
      // existe mais a été désactivé.
      prisma.salon.findUnique.mockResolvedValue({
        id: 'salon-a',
        isActive: false,
        prestations: [],
      });

      await expect(
        service.findPublicBySlug('karim-barber'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sitemap', () => {
    it('ne liste que les salons actifs', async () => {
      await service.findActiveSlugs();

      const query = firstArg<{ where: { isActive: boolean } }>(
        prisma.salon.findMany,
      );
      expect(query.where.isActive).toBe(true);
    });
  });
});
