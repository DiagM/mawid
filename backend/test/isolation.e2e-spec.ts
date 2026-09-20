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
 * Étanchéité entre salons
 * ============================================
 * Le test le plus important du projet.
 *
 * Il n'y a **pas** de Row Level Security en base (CLAUDE.md §3.2) : rien, au
 * niveau PostgreSQL, n'empêche un gérant de lire les données d'un autre salon.
 * La seule barrière est le code des services, qui retrouve systématiquement le
 * salon par `ownerId` extrait du JWT. Une ligne oubliée et la fuite est
 * silencieuse : aucune erreur, aucun log, juste les clientes d'un salon
 * visibles chez son concurrent.
 *
 * D'où le format : pour chaque ressource, le gérant A présente un identifiant
 * appartenant à B et doit être refusé.
 */
describe('Isolation entre salons (e2e)', () => {
  let ctx: TestContext;
  let server: App;

  /** Salon du gérant qui tente l'accès. */
  let salonA: SalonFixture;
  /** Salon visé par la tentative. */
  let salonB: SalonFixture;

  let tokenA: string;
  let tokenB: string;

  /** Identifiants appartenant à B, que A va tenter d'utiliser. */
  let bResources: {
    prestationId: string;
    employeeId: string;
    blockedSlotId: string;
    cashMovementId: string;
    productId: string;
    reservationId: string;
    clientId: string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);

    salonA = await createSalon(ctx.prisma, {
      slug: 'salon-a',
      phone: '+213555000001',
      name: 'Salon A',
    });
    salonB = await createSalon(ctx.prisma, {
      slug: 'salon-b',
      phone: '+213555000002',
      name: 'Salon B',
    });

    tokenA = await loginAs(server, salonA.phone, salonA.password);
    tokenB = await loginAs(server, salonB.phone, salonB.password);

    bResources = await seedSalonB();
  });

  /** Requête authentifiée en tant que gérant A. */
  function asA(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${tokenA}`);
  }

  function asB(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${tokenB}`);
  }

  /**
   * Remplit le salon B via ses propres routes authentifiées.
   *
   * Passer par l'API plutôt que d'insérer en base directement : les données
   * ainsi créées sont exactement celles qu'un vrai gérant produirait, y
   * compris les champs calculés côté service.
   */
  async function seedSalonB() {
    const date = futureLocalDate();

    const employee = await asB('post', '/employees')
      .send({ fullName: 'Nadia B' })
      .expect(201);

    const blocked = await asB('post', '/blocked-slots')
      .send({
        startsAt: `${date}T14:00:00.000Z`,
        endsAt: `${date}T15:00:00.000Z`,
        reason: 'Inventaire',
      })
      .expect(201);

    const product = await asB('post', '/products')
      .send({ name: 'Shampoing B', quantity: 10 })
      .expect(201);

    const cash = await asB('post', '/cash')
      .send({ type: 'SALE', amountCents: 150000, label: 'Vente du jour' })
      .expect(201);

    // Réservation publique chez B : crée aussi la fiche cliente.
    const availability = await request(server)
      .get(api(`/salons/${salonB.slug}/availability`))
      .query({ date, prestationIds: salonB.prestationId })
      .expect(200);

    const slot = (availability.body as { slots: { startsAt: string }[] })
      .slots[0].startsAt;

    const reservation = await request(server)
      .post(api(`/salons/${salonB.slug}/reservations`))
      .send({
        startsAt: slot,
        prestationIds: [salonB.prestationId],
        clientFirstName: 'Yasmine',
        clientPhone: '+213666000002',
      })
      .expect(201);

    const clientsOfB = await asB('get', '/clients').expect(200);

    return {
      prestationId: salonB.prestationId,
      employeeId: (employee.body as { id: string }).id,
      blockedSlotId: (blocked.body as { id: string }).id,
      cashMovementId: (cash.body as { id: string }).id,
      productId: (product.body as { id: string }).id,
      reservationId: (reservation.body as { id: string }).id,
      clientId: (clientsOfB.body as { items: { id: string }[] }).items[0].id,
    };
  }

  // ============================================
  // Lecture : chaque liste ne montre que son salon
  // ============================================

  describe('les listes du gérant ne contiennent que son salon', () => {
    it('prestations', async () => {
      const response = await asA('get', '/prestations/me').expect(200);
      const items = response.body as { id: string }[];

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(salonA.prestationId);
    });

    it('équipe', async () => {
      const response = await asA('get', '/employees').expect(200);
      expect(response.body).toEqual([]);
    });

    it('produits', async () => {
      const response = await asA('get', '/products').expect(200);
      expect(response.body).toEqual([]);
    });

    it('agenda', async () => {
      const date = futureLocalDate();
      const response = await asA('get', '/reservations/me')
        .query({ from: date, to: date })
        .expect(200);

      // B a une réservation ce jour-là, A n'en a aucune.
      expect(response.body).toEqual([]);
    });

    it('clientèle', async () => {
      const response = await asA('get', '/clients').expect(200);
      const body = response.body as { items: unknown[] };

      expect(body.items).toEqual([]);
    });

    it('salon', async () => {
      const response = await asA('get', '/salons/me').expect(200);
      const body = response.body as { id: string; name: string };

      expect(body.id).toBe(salonA.salonId);
      expect(body.name).toBe('Salon A');
    });
  });

  // ============================================
  // Écriture : un identifiant de B est refusé
  // ============================================

  describe('le gérant A ne peut pas agir sur les données de B', () => {
    it('modifier une prestation de B', async () => {
      await asA('patch', `/prestations/${bResources.prestationId}`)
        .send({ priceCents: 1 })
        .expect(403);
    });

    it('supprimer une prestation de B', async () => {
      await asA('delete', `/prestations/${bResources.prestationId}`).expect(
        403,
      );
    });

    it('modifier un membre de B', async () => {
      await asA('patch', `/employees/${bResources.employeeId}`)
        .send({ fullName: 'Détourné' })
        .expect(403);
    });

    it('archiver un membre de B', async () => {
      await asA('delete', `/employees/${bResources.employeeId}`).expect(403);
    });

    it('supprimer un créneau bloqué de B', async () => {
      await asA('delete', `/blocked-slots/${bResources.blockedSlotId}`).expect(
        403,
      );
    });

    it('modifier un produit de B', async () => {
      await asA('patch', `/products/${bResources.productId}`)
        .send({ name: 'Volé' })
        .expect(403);
    });

    it('bouger le stock de B', async () => {
      await asA('post', `/products/${bResources.productId}/movements`)
        .send({ delta: -5 })
        .expect(403);
    });

    it('lire les mouvements de stock de B', async () => {
      await asA('get', `/products/${bResources.productId}/movements`).expect(
        403,
      );
    });

    it('supprimer un mouvement de caisse de B', async () => {
      await asA('delete', `/cash/${bResources.cashMovementId}`).expect(403);
    });

    it('qualifier une réservation de B', async () => {
      await asA('patch', `/reservations/${bResources.reservationId}/status`)
        .send({ status: 'NO_SHOW' })
        .expect(403);
    });

    it('lire une fiche cliente de B', async () => {
      // 404 et non 403 : la cliente existe bien, mais pas « dans votre
      // salon ». Confirmer son existence à un concurrent serait déjà une
      // fuite — il apprendrait qu'un numéro donné fréquente la plateforme.
      await asA('get', `/clients/${bResources.clientId}`).expect(404);
    });
  });

  // ============================================
  // Injection d'identifiants étrangers dans un corps de requête
  // ============================================

  describe('un identifiant étranger glissé dans le corps est refusé', () => {
    it('rattacher un encaissement à une réservation de B', async () => {
      await asA('post', '/cash')
        .send({
          type: 'SALE',
          amountCents: 5000,
          label: 'Encaissement',
          reservationId: bResources.reservationId,
        })
        .expect(404);
    });

    it('attribuer un encaissement à un membre de B', async () => {
      await asA('post', '/cash')
        .send({
          type: 'SALE',
          amountCents: 5000,
          label: 'Encaissement',
          employeeId: bResources.employeeId,
        })
        .expect(404);
    });
  });

  // ============================================
  // Les données restent intactes après les tentatives
  // ============================================

  it('aucune tentative de A n’a modifié les données de B', async () => {
    await asA('patch', `/prestations/${bResources.prestationId}`)
      .send({ priceCents: 1 })
      .expect(403);
    await asA('post', `/products/${bResources.productId}/movements`)
      .send({ delta: -10 })
      .expect(403);

    const prestations = await asB('get', '/prestations/me').expect(200);
    const products = await asB('get', '/products').expect(200);

    expect((prestations.body as { priceCents: number }[])[0].priceCents).toBe(
      80000,
    );
    expect((products.body as { quantity: number }[])[0].quantity).toBe(10);
  });

  // ============================================
  // Routes protégées : sans JWT, rien ne passe
  // ============================================

  describe('sans authentification', () => {
    const protectedRoutes: ['get' | 'post' | 'patch' | 'delete', string][] = [
      ['get', '/salons/me'],
      ['patch', '/salons/me'],
      ['get', '/prestations/me'],
      ['post', '/prestations'],
      ['get', '/reservations/me'],
      ['get', '/reservations/quota'],
      ['get', '/blocked-slots'],
      ['get', '/employees'],
      ['get', '/clients'],
      ['get', '/cash'],
      ['get', '/products'],
      ['get', '/reviews/me'],
      ['get', '/stats/me'],
      ['get', '/auth/me'],
    ];

    it.each(protectedRoutes)('%s %s renvoie 401', async (method, path) => {
      await request(server)[method](api(path)).expect(401);
    });

    it('un JWT signé avec un autre secret est refusé', async () => {
      // Forge grossière : un token bien formé mais signé ailleurs. Si la
      // vérification de signature sautait, ce test le verrait immédiatement.
      const forged = [
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
          'base64url',
        ),
        Buffer.from(
          JSON.stringify({ sub: salonB.userId, exp: 9999999999 }),
        ).toString('base64url'),
        'signature-bidon',
      ].join('.');

      await request(server)
        .get(api('/salons/me'))
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });
  });
});
