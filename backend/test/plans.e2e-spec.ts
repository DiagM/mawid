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
  createSalon,
  futureLocalDate,
  type SalonFixture,
} from './helpers/fixtures';

/**
 * ============================================
 * Conditionnement par offre
 * ============================================
 * Une règle domine tout le reste et se vérifie en dernière section :
 * **l'offre du salon ne doit jamais dégrader l'expérience de la cliente.**
 * Le quota mensuel est la seule exception assumée du produit ; aucun verrou
 * de module ne doit s'y ajouter.
 *
 * La seconde règle porte sur les déclassements : un verrou empêche
 * d'AJOUTER, jamais d'accéder à l'existant. Un salon qui repasse en Gratuit
 * garde son équipe et son historique de caisse.
 */
describe('Offres et modules (e2e)', () => {
  let ctx: TestContext;
  let server: App;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  /** Salon d'une offre donnée, plus le jeton de son gérant. */
  async function salonOn(
    plan: 'FREE' | 'PRO' | 'PRO_PLUS',
    suffix = '1',
  ): Promise<{ salon: SalonFixture; token: string }> {
    const salon = await createSalon(ctx.prisma, {
      slug: `salon-${plan.toLowerCase()}-${suffix}`,
      phone: `+21355510${suffix.padStart(4, '0')}`,
      plan,
    });

    return { salon, token: await loginAs(server, salon.phone, salon.password) };
  }

  function as(
    token: string,
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
  ) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${token}`);
  }

  // ============================================
  // Ce que chaque offre ouvre
  // ============================================

  describe('offre Gratuite', () => {
    it('refuse les fiches clientes, la caisse et les stocks', async () => {
      const { token } = await salonOn('FREE');

      await as(token, 'get', '/clients').expect(403);
      await as(token, 'get', '/cash').expect(403);
      await as(token, 'get', '/products').expect(403);
    });

    it('nomme l’offre requise plutôt que de refuser sèchement', async () => {
      const { token } = await salonOn('FREE');

      const clients = await as(token, 'get', '/clients').expect(403);
      const cash = await as(token, 'get', '/cash').expect(403);

      // Un refus qui n'indique pas quoi faire ensuite ressemble à une panne
      // et ne vend rien.
      expect((clients.body as { message: string }).message).toMatch(/Pro\b/);
      expect((cash.body as { message: string }).message).toMatch(/Pro\+/);
    });

    it('laisse l’agenda, les prestations et les avis ouverts', async () => {
      const { token } = await salonOn('FREE');

      await as(token, 'get', '/reservations/me').expect(200);
      await as(token, 'get', '/prestations/me').expect(200);
      await as(token, 'get', '/reviews/me').expect(200);
      await as(token, 'get', '/blocked-slots').expect(200);
      await as(token, 'get', '/salons/me').expect(200);
    });

    it('gère une seule personne', async () => {
      const { token } = await salonOn('FREE');

      await as(token, 'post', '/employees')
        .send({ fullName: 'Nadia' })
        .expect(201);

      const refused = await as(token, 'post', '/employees')
        .send({ fullName: 'Sofia' })
        .expect(403);

      expect((refused.body as { message: string }).message).toMatch(
        /une seule personne/i,
      );
    });

    it('libère la place quand un membre est archivé', async () => {
      const { token } = await salonOn('FREE');

      const nadia = await as(token, 'post', '/employees')
        .send({ fullName: 'Nadia' })
        .expect(201);

      await as(
        token,
        'delete',
        `/employees/${(nadia.body as { id: string }).id}`,
      ).expect(204);

      // Sinon un salon qui change d'employé resterait bloqué à vie.
      await as(token, 'post', '/employees')
        .send({ fullName: 'Sofia' })
        .expect(201);
    });

    it('ne laisse pas contourner le plafond par une réactivation', async () => {
      const { token } = await salonOn('FREE');

      const nadia = await as(token, 'post', '/employees')
        .send({ fullName: 'Nadia' })
        .expect(201);
      const nadiaId = (nadia.body as { id: string }).id;

      await as(token, 'delete', `/employees/${nadiaId}`).expect(204);
      await as(token, 'post', '/employees')
        .send({ fullName: 'Sofia' })
        .expect(201);

      // Réactiver Nadia ferait deux membres actifs : archiver puis restaurer
      // ne doit pas être une faille.
      await as(token, 'patch', `/employees/${nadiaId}`)
        .send({ isActive: true })
        .expect(403);
    });

    it('limite les statistiques au mois en cours', async () => {
      const { token } = await salonOn('FREE');

      const response = await as(token, 'get', '/stats/me')
        .query({ from: '2020-01-01', to: futureLocalDate(0) })
        .expect(200);

      // Tronqué et non refusé : une statistique partielle reste lisible,
      // un écran qui refuse de s'afficher donne l'impression d'une panne.
      const from = (response.body as { period: { from: string } }).period.from;
      expect(from).not.toBe('2020-01-01');
      expect(from.endsWith('-01')).toBe(true);
    });
  });

  describe('offre Pro', () => {
    it('ouvre les fiches clientes et l’équipe sans plafond', async () => {
      const { token } = await salonOn('PRO', '2');

      await as(token, 'get', '/clients').expect(200);

      for (const fullName of ['Nadia', 'Sofia', 'Lina']) {
        await as(token, 'post', '/employees').send({ fullName }).expect(201);
      }
    });

    it('garde la caisse et les stocks fermés', async () => {
      const { token } = await salonOn('PRO', '2');

      await as(token, 'get', '/cash').expect(403);
      await as(token, 'get', '/products').expect(403);
    });

    it('ne tronque plus les statistiques', async () => {
      const { token } = await salonOn('PRO', '2');

      const response = await as(token, 'get', '/stats/me')
        .query({ from: '2020-01-01', to: futureLocalDate(0) })
        .expect(200);

      expect((response.body as { period: { from: string } }).period.from).toBe(
        '2020-01-01',
      );
    });
  });

  describe('offre Pro+', () => {
    it('ouvre tout', async () => {
      const { token } = await salonOn('PRO_PLUS', '3');

      await as(token, 'get', '/clients').expect(200);
      await as(token, 'get', '/cash').expect(200);
      await as(token, 'get', '/products').expect(200);
      await as(token, 'get', '/stats/me').expect(200);
    });

    it('permet de saisir caisse et stock', async () => {
      const { token } = await salonOn('PRO_PLUS', '3');

      await as(token, 'post', '/cash')
        .send({ type: 'SALE', amountCents: 150000, label: 'Vente' })
        .expect(201);

      const product = await as(token, 'post', '/products')
        .send({ name: 'Shampoing', quantity: 10 })
        .expect(201);

      await as(
        token,
        'post',
        `/products/${(product.body as { id: string }).id}/movements`,
      )
        .send({ delta: -3 })
        .expect(201);
    });
  });

  // ============================================
  // Déclassement
  // ============================================

  describe('déclassement', () => {
    it('ne détruit ni l’équipe ni l’historique de caisse', async () => {
      const { salon, token } = await salonOn('PRO_PLUS', '4');

      for (const fullName of ['Nadia', 'Sofia', 'Lina']) {
        await as(token, 'post', '/employees').send({ fullName }).expect(201);
      }
      await as(token, 'post', '/cash')
        .send({ type: 'SALE', amountCents: 150000, label: 'Vente' })
        .expect(201);

      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { plan: 'FREE' },
      });

      // Les trois membres restent actifs : un déclassement qui casserait
      // l'agenda transformerait chaque fin d'abonnement en catastrophe.
      const team = await as(token, 'get', '/employees').expect(200);
      expect(team.body as unknown[]).toHaveLength(3);
      expect(
        (team.body as { isActive: boolean }[]).every((e) => e.isActive),
      ).toBe(true);

      // Le mouvement de caisse n'est plus consultable mais existe toujours.
      await as(token, 'get', '/cash').expect(403);
      const movements = await ctx.prisma.cashMovement.count({
        where: { salonId: salon.salonId },
      });
      expect(movements).toBe(1);
    });

    it('empêche seulement d’ajouter', async () => {
      const { salon, token } = await salonOn('PRO_PLUS', '4');

      await as(token, 'post', '/employees')
        .send({ fullName: 'Nadia' })
        .expect(201);
      await as(token, 'post', '/employees')
        .send({ fullName: 'Sofia' })
        .expect(201);

      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { plan: 'FREE' },
      });

      await as(token, 'post', '/employees')
        .send({ fullName: 'Lina' })
        .expect(403);
    });
  });

  // ============================================
  // La règle qui prime sur toutes les autres
  // ============================================

  describe('la cliente ne subit jamais l’offre du salon', () => {
    it('réserve, annule et note à l’identique dans un salon Gratuit', async () => {
      const { salon, token } = await salonOn('FREE', '5');
      const date = futureLocalDate();

      const availability = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const slot = (availability.body as { slots: { startsAt: string }[] })
        .slots[0].startsAt;

      const reservation = await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: slot,
          prestationIds: [salon.prestationId],
          clientFirstName: 'Amina',
          clientPhone: '+213662000001',
        })
        .expect(201);

      const { id, cancellationToken } = reservation.body as {
        id: string;
        cancellationToken: string;
      };

      await request(server)
        .get(api(`/reservations/token/${cancellationToken}`))
        .expect(200);

      await as(token, 'patch', `/reservations/${id}/status`)
        .send({ status: 'HONORED' })
        .expect(200);

      await request(server)
        .post(api(`/reservations/token/${cancellationToken}/review`))
        .send({ rating: 5 })
        .expect(201);

      // Et la fiche publique reste complète.
      const page = await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(200);
      expect(
        (page.body as { prestations: unknown[] }).prestations,
      ).toHaveLength(1);
    });
  });
});
