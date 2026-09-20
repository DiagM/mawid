import request from 'supertest';
import type { App } from 'supertest/types';
import {
  api,
  createTestApp,
  loginAs,
  resetDatabase,
  type TestContext,
} from './helpers/app';
import {
  createAdmin,
  createSalon,
  type AdminFixture,
  type SalonFixture,
} from './helpers/fixtures';

/**
 * ============================================
 * Console d'administration
 * ============================================
 * `AdminService` est le seul service du projet à agir hors de tout périmètre
 * de salon : il voit tous les salons, tous les gérants, tous les avis.
 * Partout ailleurs la règle est l'inverse — retrouver le salon par `ownerId`
 * extrait du JWT (CLAUDE.md §3.2).
 *
 * Cette exception fait de `RolesGuard` le point de défaillance le plus coûteux
 * du produit : une erreur ici ne fuiterait pas les données d'un salon, mais
 * celles de tous. D'où la première section de ce fichier, qui passe chaque
 * route en revue avec un simple gérant.
 */
describe('Console d’administration (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: AdminFixture;
  let salonA: SalonFixture;
  let salonB: SalonFixture;
  let adminToken: string;
  let managerToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);

    admin = await createAdmin(ctx.prisma);
    salonA = await createSalon(ctx.prisma, {
      slug: 'salon-a',
      phone: '+213555800001',
      name: 'Salon A',
      plan: 'FREE',
    });
    salonB = await createSalon(ctx.prisma, {
      slug: 'salon-b',
      phone: '+213555800002',
      name: 'Salon B',
      plan: 'PRO',
    });

    adminToken = await loginAs(server, admin.phone, admin.password);
    managerToken = await loginAs(server, salonA.phone, salonA.password);
  });

  function asAdmin(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${adminToken}`);
  }

  // ============================================
  // La porte
  // ============================================

  describe('un gérant ne franchit aucune route', () => {
    const routes: ['get' | 'post' | 'patch', string][] = [
      ['get', '/admin/overview'],
      ['get', '/admin/salons'],
      ['patch', '/admin/salons/nimporte'],
      ['post', '/admin/managers'],
      ['post', '/admin/managers/nimporte/reset-password'],
      ['get', '/admin/reviews'],
      ['patch', '/admin/reviews/nimporte'],
    ];

    it.each(routes)('%s %s renvoie 403', async (method, path) => {
      await request(server)
        [method](api(path))
        .set('Authorization', `Bearer ${managerToken}`)
        .send({})
        .expect(403);
    });

    it.each(routes)('%s %s renvoie 401 sans JWT', async (method, path) => {
      await request(server)[method](api(path)).send({}).expect(401);
    });

    it('le refus ne révèle pas le rôle attendu', async () => {
      const response = await request(server)
        .get(api('/admin/overview'))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);

      const message = (response.body as { message: string }).message;
      expect(message).toBe('Accès refusé');
      expect(message).not.toMatch(/admin/i);
    });

    it('perdre le rôle ADMIN coupe l’accès sans attendre l’expiration du JWT', async () => {
      await asAdmin('get', '/admin/overview').expect(200);

      await ctx.prisma.user.update({
        where: { id: admin.userId },
        data: { role: 'MANAGER' },
      });

      // Le même token, émis quand le compte était ADMIN, ne passe plus : le
      // rôle est relu en base à chaque requête, pas lu dans le JWT.
      await asAdmin('get', '/admin/overview').expect(403);
    });
  });

  // ============================================
  // Vue d'ensemble
  // ============================================

  describe('vue d’ensemble', () => {
    it('compte les salons, dont ceux en attente de validation', async () => {
      await ctx.prisma.salon.update({
        where: { id: salonB.salonId },
        data: { isActive: false },
      });

      const response = await asAdmin('get', '/admin/overview').expect(200);
      const body = response.body as {
        salons: { total: number; active: number; pending: number };
        managers: number;
      };

      expect(body.salons.total).toBe(2);
      expect(body.salons.active).toBe(1);
      expect(body.salons.pending).toBe(1);
      // Le fondateur n'est pas un gérant : il ne doit pas être compté.
      expect(body.managers).toBe(2);
    });
  });

  // ============================================
  // Salons
  // ============================================

  describe('liste des salons', () => {
    it('affiche le gérant et la consommation de chacun', async () => {
      const response = await asAdmin('get', '/admin/salons').expect(200);
      const items = response.body as {
        slug: string;
        owner: { phone: string };
        quota: { plan: string; limit: number | null };
        prestations: number;
      }[];

      expect(items).toHaveLength(2);

      const a = items.find((item) => item.slug === 'salon-a')!;
      expect(a.owner.phone).toBe(salonA.phone);
      expect(a.quota.plan).toBe('FREE');
      expect(a.quota.limit).toBe(30);
      expect(a.prestations).toBe(1);

      const b = items.find((item) => item.slug === 'salon-b')!;
      expect(b.quota.limit).toBeNull();
    });

    it('ne fait jamais sortir un hash de mot de passe', async () => {
      const response = await asAdmin('get', '/admin/salons').expect(200);

      expect(JSON.stringify(response.body)).not.toMatch(
        /passwordHash|\$2[aby]\$/,
      );
    });

    it('filtre les salons en attente', async () => {
      await ctx.prisma.salon.update({
        where: { id: salonB.salonId },
        data: { isActive: false },
      });

      const response = await asAdmin('get', '/admin/salons')
        .query({ status: 'pending' })
        .expect(200);

      const items = response.body as { slug: string }[];
      expect(items.map((item) => item.slug)).toEqual(['salon-b']);
    });

    it('cherche par numéro de gérant', async () => {
      const response = await asAdmin('get', '/admin/salons')
        .query({ q: '800002' })
        .expect(200);

      const items = response.body as { slug: string }[];
      expect(items.map((item) => item.slug)).toEqual(['salon-b']);
    });
  });

  describe('actions commerciales', () => {
    it('active un salon, qui devient aussitôt visible du public', async () => {
      await ctx.prisma.salon.update({
        where: { id: salonB.salonId },
        data: { isActive: false },
      });
      await request(server)
        .get(api(`/salons/${salonB.slug}`))
        .expect(404);

      await asAdmin('patch', `/admin/salons/${salonB.salonId}`)
        .send({ isActive: true })
        .expect(200);

      await request(server)
        .get(api(`/salons/${salonB.slug}`))
        .expect(200);
    });

    it('change l’offre, ce qui lève le quota', async () => {
      await asAdmin('patch', `/admin/salons/${salonA.salonId}`)
        .send({ plan: 'PRO' })
        .expect(200);

      const response = await asAdmin('get', '/admin/salons').expect(200);
      const a = (
        response.body as { slug: string; quota: { limit: null } }[]
      ).find((item) => item.slug === 'salon-a')!;

      expect(a.quota.limit).toBeNull();
    });

    it('vend une mise en avant, qui remonte le salon dans la recherche', async () => {
      // « Salon B » passe après « Salon A » alphabétiquement : s'il remonte,
      // c'est bien la mise en avant qui agit.
      await asAdmin('patch', `/admin/salons/${salonB.salonId}`)
        .send({ featuredWeeks: 2 })
        .expect(200);

      const search = await request(server).get(api('/salons')).expect(200);
      const items = (
        search.body as { items: { slug: string; isFeatured: boolean }[] }
      ).items;

      expect(items[0].slug).toBe('salon-b');
      expect(items[0].isFeatured).toBe(true);
    });

    it('retire une mise en avant avec 0 semaine', async () => {
      await asAdmin('patch', `/admin/salons/${salonB.salonId}`)
        .send({ featuredWeeks: 2 })
        .expect(200);
      await asAdmin('patch', `/admin/salons/${salonB.salonId}`)
        .send({ featuredWeeks: 0 })
        .expect(200);

      const search = await request(server).get(api('/salons')).expect(200);
      const items = (
        search.body as { items: { slug: string; isFeatured: boolean }[] }
      ).items;

      expect(items[0].slug).toBe('salon-a');
      expect(items.every((item) => item.isFeatured === false)).toBe(true);
    });

    it('refuse un champ hors périmètre commercial', async () => {
      // Le nom, l'adresse ou les horaires appartiennent au gérant : la
      // plateforme n'a pas à les réécrire depuis sa console.
      await asAdmin('patch', `/admin/salons/${salonA.salonId}`)
        .send({ name: 'Renommé par la plateforme' })
        .expect(400);
    });

    it('refuse une mise en avant absurde', async () => {
      await asAdmin('patch', `/admin/salons/${salonA.salonId}`)
        .send({ featuredWeeks: 500 })
        .expect(400);
    });
  });

  // ============================================
  // Onboarding commercial
  // ============================================

  describe('création d’un gérant', () => {
    const NEW_MANAGER = {
      phone: '0555900001',
      fullName: 'Amel Gérante',
      salonName: 'Institut Élégance',
      addressLine: '12 rue Didouche Mourad',
      district: 'Alger Centre',
      contactPhone: '0661900001',
    };

    it('crée le compte et son salon, actif d’emblée', async () => {
      const response = await asAdmin('post', '/admin/managers')
        .send(NEW_MANAGER)
        .expect(201);

      const body = response.body as {
        user: { phone: string };
        salon: { slug: string; isActive: boolean };
        password: string;
      };

      expect(body.user.phone).toBe('+213555900001');
      expect(body.salon.slug).toBe('institut-elegance');
      // Créé par la plateforme : la validation manuelle n'a plus d'objet.
      expect(body.salon.isActive).toBe(true);
      expect(body.password).toHaveLength(16);
    });

    it('le gérant peut se connecter avec le mot de passe affiché', async () => {
      const response = await asAdmin('post', '/admin/managers')
        .send(NEW_MANAGER)
        .expect(201);
      const { password } = response.body as { password: string };

      const login = await request(server)
        .post(api('/auth/login'))
        .send({ phone: '+213555900001', password })
        .expect(200);

      // Le mot de passe vient de la plateforme : deux personnes le
      // connaissent, le gérant doit donc le remplacer.
      expect(
        (login.body as { user: { mustChangePassword: boolean } }).user
          .mustChangePassword,
      ).toBe(true);
    });

    it('dérive un slug unique quand le nom est déjà pris', async () => {
      await asAdmin('post', '/admin/managers').send(NEW_MANAGER).expect(201);

      const second = await asAdmin('post', '/admin/managers')
        .send({
          ...NEW_MANAGER,
          phone: '0555900002',
          contactPhone: '0661900002',
        })
        .expect(201);

      expect((second.body as { salon: { slug: string } }).salon.slug).toBe(
        'institut-elegance-2',
      );
    });

    it('refuse un numéro déjà inscrit', async () => {
      await asAdmin('post', '/admin/managers')
        .send({ ...NEW_MANAGER, phone: salonA.phone })
        .expect(409);
    });

    it('refuse un rôle imposé', async () => {
      await asAdmin('post', '/admin/managers')
        .send({ ...NEW_MANAGER, role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('réinitialisation de mot de passe', () => {
    it('remplace le mot de passe et invalide l’ancien', async () => {
      const response = await asAdmin(
        'post',
        `/admin/managers/${salonA.userId}/reset-password`,
      ).expect(201);

      const { password } = response.body as { password: string };

      await request(server)
        .post(api('/auth/login'))
        .send({ phone: salonA.phone, password: salonA.password })
        .expect(401);

      await request(server)
        .post(api('/auth/login'))
        .send({ phone: salonA.phone, password })
        .expect(200);
    });

    it('refuse un compte inconnu', async () => {
      await asAdmin(
        'post',
        '/admin/managers/compte-fantome/reset-password',
      ).expect(404);
    });
  });

  // ============================================
  // Modération des avis
  // ============================================

  describe('modération des avis', () => {
    /** Dépose un avis réel chez le salon A, en passant par tout le parcours. */
    async function leaveReview(
      rating: number,
    ): Promise<{ reviewId: string; token: string }> {
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Algiers',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

      const availability = await request(server)
        .get(api(`/salons/${salonA.slug}/availability`))
        .query({ date, prestationIds: salonA.prestationId })
        .expect(200);

      const slot = (availability.body as { slots: { startsAt: string }[] })
        .slots[0].startsAt;

      const reservation = await request(server)
        .post(api(`/salons/${salonA.slug}/reservations`))
        .send({
          startsAt: slot,
          prestationIds: [salonA.prestationId],
          clientFirstName: 'Concurrente',
          clientPhone: '+213677000001',
        })
        .expect(201);

      const { id, cancellationToken } = reservation.body as {
        id: string;
        cancellationToken: string;
      };

      await request(server)
        .patch(api(`/reservations/${id}/status`))
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'HONORED' })
        .expect(200);

      const review = await request(server)
        .post(api(`/reservations/token/${cancellationToken}/review`))
        .send({ rating, comment: 'Avis à modérer' })
        .expect(201);

      return {
        reviewId: (review.body as { id: string }).id,
        token: cancellationToken,
      };
    }

    it('masque un avis, qui disparaît de la fiche publique', async () => {
      const { reviewId } = await leaveReview(1);

      const before = await request(server)
        .get(api(`/salons/${salonA.slug}/reviews`))
        .expect(200);
      expect((before.body as { count: number }).count).toBe(1);

      await asAdmin('patch', `/admin/reviews/${reviewId}`)
        .send({ isPublished: false })
        .expect(200);

      const after = await request(server)
        .get(api(`/salons/${salonA.slug}/reviews`))
        .expect(200);
      expect((after.body as { count: number }).count).toBe(0);
      expect((after.body as { average: number | null }).average).toBeNull();
    });

    it('republie un avis masqué à tort', async () => {
      const { reviewId } = await leaveReview(2);

      await asAdmin('patch', `/admin/reviews/${reviewId}`)
        .send({ isPublished: false })
        .expect(200);
      await asAdmin('patch', `/admin/reviews/${reviewId}`)
        .send({ isPublished: true })
        .expect(200);

      const response = await request(server)
        .get(api(`/salons/${salonA.slug}/reviews`))
        .expect(200);
      expect((response.body as { count: number }).count).toBe(1);
    });

    it('un avis masqué reste en base et bloque un second dépôt', async () => {
      const { reviewId, token } = await leaveReview(1);

      await asAdmin('patch', `/admin/reviews/${reviewId}`)
        .send({ isPublished: false })
        .expect(200);

      // Le cœur de la décision « masquer plutôt que supprimer » : la ligne
      // survit, donc l'unicité sur `reservationId` tient toujours. Supprimer
      // l'avis rendrait la modération inutile — il suffirait d'en redéposer
      // un identique depuis le même lien.
      await request(server)
        .post(api(`/reservations/token/${token}/review`))
        .send({ rating: 1, comment: 'Je recommence' })
        .expect(409);

      const hidden = await asAdmin('get', '/admin/reviews')
        .query({ visibility: 'hidden' })
        .expect(200);

      expect(response(hidden)).toHaveLength(1);
    });

    it('filtre les notes basses', async () => {
      await leaveReview(1);

      const low = await asAdmin('get', '/admin/reviews')
        .query({ maxRating: 2 })
        .expect(200);
      expect(response(low)).toHaveLength(1);

      const veryLow = await asAdmin('get', '/admin/reviews')
        .query({ maxRating: 1 })
        .expect(200);
      expect(response(veryLow)).toHaveLength(1);
    });

    it('le gérant ne dispose toujours d’aucune route de modération', async () => {
      const { reviewId } = await leaveReview(1);

      await request(server)
        .patch(api(`/admin/reviews/${reviewId}`))
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ isPublished: false })
        .expect(403);
    });
  });
});

/** Corps d'une réponse de liste, typé pour éviter un `any` par assertion. */
function response(res: { body: unknown }): unknown[] {
  return res.body as unknown[];
}
