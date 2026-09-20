import request from 'supertest';
import type { App } from 'supertest/types';
import {
  api,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './helpers/app';
import { createSalon, type SalonFixture } from './helpers/fixtures';

/**
 * ============================================
 * Surface publique
 * ============================================
 * Tout ce qu'un visiteur non authentifié peut atteindre : la recherche, la
 * fiche salon, le sitemap. C'est aussi la seule partie indexée par Google,
 * donc celle dont une régression coûte des clients sans qu'aucune alerte ne
 * se déclenche.
 */
describe('Surface publique (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    salon = await createSalon(ctx.prisma, {
      slug: 'salon-elegance',
      phone: '+213555700001',
      name: 'Salon Élégance',
      prestationName: 'Brushing',
    });
  });

  it('répond sur /health avec l’état de la base', async () => {
    const response = await request(server).get(api('/health')).expect(200);
    const body = response.body as {
      status: string;
      database: { connected: boolean };
    };

    expect(body.status).toBe('ok');
    expect(body.database.connected).toBe(true);
  });

  describe('fiche salon', () => {
    it('expose ce dont la page publique a besoin', async () => {
      const response = await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(200);

      const body = response.body as Record<string, unknown>;

      // Ces quatre champs ont déjà disparu d'un `select` par le passé, ce qui
      // a silencieusement cassé le lien d'appel, le badge « entre femmes »,
      // le `telephone` du JSON-LD et le repli wa.me. D'où ce verrou.
      expect(body.contactPhone).toBe('+213555000000');
      expect(body.isWomenOnly).toBe(false);
      expect(body.openingHours).toBeDefined();
      expect(body.prestations).toHaveLength(1);
    });

    it('ne laisse fuiter ni le propriétaire ni les données de gestion', async () => {
      const response = await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(200);

      const body = response.body as Record<string, unknown>;

      expect(body).not.toHaveProperty('ownerId');
      expect(body).not.toHaveProperty('owner');
      expect(body).not.toHaveProperty('plan');
      expect(body).not.toHaveProperty('featuredUntil');
    });

    it('renvoie 404 sur un salon inactif', async () => {
      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { isActive: false },
      });

      await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(404);
    });

    it('renvoie 404 sur un slug inconnu', async () => {
      await request(server).get(api('/salons/salon-fantome')).expect(404);
    });
  });

  describe('recherche', () => {
    it('trouve un salon malgré les accents', async () => {
      // « elegance » doit trouver « Élégance » : personne ne tape les accents
      // sur un clavier de téléphone. D'où l'extension `unaccent` en base.
      const response = await request(server)
        .get(api('/salons'))
        .query({ q: 'elegance' })
        .expect(200);

      const items = (response.body as { items: { slug: string }[] }).items;
      expect(items.map((item) => item.slug)).toContain(salon.slug);
    });

    it('trouve un salon par le nom d’une prestation', async () => {
      const response = await request(server)
        .get(api('/salons'))
        .query({ q: 'brushing' })
        .expect(200);

      const items = (response.body as { items: { slug: string }[] }).items;
      expect(items.map((item) => item.slug)).toContain(salon.slug);
    });

    it('ne traite pas les caractères SQL LIKE comme des jokers', async () => {
      // Un `%` non échappé ferait correspondre n'importe quel salon.
      const response = await request(server)
        .get(api('/salons'))
        .query({ q: '%%' })
        .expect(200);

      expect((response.body as { items: unknown[] }).items).toHaveLength(0);
    });

    it('filtre par ville', async () => {
      await createSalon(ctx.prisma, {
        slug: 'salon-oran',
        phone: '+213555700002',
        name: 'Salon Oran',
        city: 'Oran',
      });

      const response = await request(server)
        .get(api('/salons'))
        .query({ city: 'Oran' })
        .expect(200);

      const items = (response.body as { items: { slug: string }[] }).items;
      expect(items.map((item) => item.slug)).toEqual(['salon-oran']);
    });

    it('refuse une ville hors périmètre', async () => {
      await request(server)
        .get(api('/salons'))
        .query({ city: 'Casablanca' })
        .expect(400);
    });

    it('affiche le prix d’appel en centimes entiers', async () => {
      const response = await request(server).get(api('/salons')).expect(200);
      const items = (response.body as { items: { fromPriceCents: number }[] })
        .items;

      // Centimes DZD entiers (CLAUDE.md §3.5) : un flottant ici ferait
      // afficher « 800,0000000001 DA » tôt ou tard.
      expect(Number.isInteger(items[0].fromPriceCents)).toBe(true);
      expect(items[0].fromPriceCents).toBe(80000);
    });

    it('n’affiche jamais un salon inactif', async () => {
      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { isActive: false },
      });

      const response = await request(server).get(api('/salons')).expect(200);
      expect((response.body as { items: unknown[] }).items).toHaveLength(0);
    });
  });

  describe('mise en avant payante', () => {
    it('place les salons en avant devant les autres', async () => {
      const featured = await createSalon(ctx.prisma, {
        slug: 'salon-zenith',
        phone: '+213555700003',
        // « Zénith » passerait après « Élégance » dans l'ordre alphabétique :
        // s'il remonte, c'est bien la mise en avant qui agit.
        name: 'Zénith Beauté',
      });

      await ctx.prisma.salon.update({
        where: { id: featured.salonId },
        data: { featuredUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
      });

      const response = await request(server).get(api('/salons')).expect(200);
      const items = (
        response.body as { items: { slug: string; isFeatured: boolean }[] }
      ).items;

      expect(items[0].slug).toBe('salon-zenith');
      expect(items[0].isFeatured).toBe(true);
    });

    it('ignore une mise en avant expirée', async () => {
      const expired = await createSalon(ctx.prisma, {
        slug: 'salon-zenith',
        phone: '+213555700003',
        name: 'Zénith Beauté',
      });

      await ctx.prisma.salon.update({
        where: { id: expired.salonId },
        data: { featuredUntil: new Date(Date.now() - 24 * 3600 * 1000) },
      });

      const response = await request(server).get(api('/salons')).expect(200);
      const items = (
        response.body as { items: { slug: string; isFeatured: boolean }[] }
      ).items;

      // Une date passée non nulle se trie AVANT les `null` : sans traitement
      // explicite, un salon dont l'abonnement a expiré resterait en tête
      // indéfiniment. C'est déjà arrivé.
      expect(items[0].slug).toBe('salon-elegance');
      expect(items.every((item) => item.isFeatured === false)).toBe(true);
    });
  });

  describe('sitemap', () => {
    it('ne liste que les salons actifs', async () => {
      const hidden = await createSalon(ctx.prisma, {
        slug: 'salon-cache',
        phone: '+213555700004',
      });
      await ctx.prisma.salon.update({
        where: { id: hidden.salonId },
        data: { isActive: false },
      });

      const response = await request(server)
        .get(api('/salons/sitemap'))
        .expect(200);

      const slugs = (response.body as { slug: string }[]).map(
        (item) => item.slug,
      );

      expect(slugs).toContain('salon-elegance');
      expect(slugs).not.toContain('salon-cache');
    });
  });
});
