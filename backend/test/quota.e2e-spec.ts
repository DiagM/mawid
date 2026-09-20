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
import { MONTHLY_RESERVATION_QUOTA } from '../src/common/plans';

/**
 * ============================================
 * Quota mensuel par offre
 * ============================================
 * C'est la seule règle du produit qui refuse un vrai client pour une raison
 * qui ne le concerne pas : le salon a épuisé son forfait. Elle mérite donc
 * d'être verrouillée dans les deux sens.
 *
 * - Trop laxiste, le modèle économique ne tient pas : l'offre gratuite
 *   absorberait tout et personne ne passerait au payant.
 * - Trop stricte, on refuse des clientes à un salon qui paie.
 */
describe('Quota mensuel (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let date: string;

  /** 30 en offre gratuite — lu depuis la source pour rester synchronisé. */
  const freeLimit = MONTHLY_RESERVATION_QUOTA.FREE as number;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    date = futureLocalDate();
  });

  /**
   * Remplit le compteur du mois sans passer par l'API.
   *
   * Passer 30 réservations par les routes publiques prendrait des dizaines de
   * requêtes et se heurterait aux plafonds par téléphone, qui ne sont pas le
   * sujet ici. Les créneaux sont espacés d'une heure pour ne pas déclencher
   * la contrainte d'exclusion.
   */
  async function fillQuota(salon: SalonFixture, count: number) {
    const base = new Date('2026-01-05T08:00:00.000Z').getTime();

    for (let index = 0; index < count; index += 1) {
      const client = await ctx.prisma.client.create({
        data: {
          phone: `+2136${String(6000000 + index).padStart(8, '0')}`,
          firstName: `Cliente${index}`,
        },
      });

      const startsAt = new Date(base + index * 60 * 60 * 1000);

      await ctx.prisma.reservation.create({
        data: {
          salonId: salon.salonId,
          clientId: client.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
          clientFirstName: client.firstName,
          clientPhone: client.phone,
        },
      });
    }
  }

  /**
   * Tentative de réservation publique par une nouvelle cliente.
   * Renvoie la réponse brute : le statut attendu varie d'un scénario à
   * l'autre, c'est précisément ce que ces tests observent.
   */
  async function book(salon: SalonFixture): Promise<request.Response> {
    const availability = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    const slot = (availability.body as { slots: { startsAt: string }[] })
      .slots[0].startsAt;

    return request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt: slot,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Nouvelle',
        clientPhone: '+213699999999',
      });
  }

  function quotaOf(token: string) {
    return request(server)
      .get(api('/reservations/quota'))
      .set('Authorization', `Bearer ${token}`);
  }

  describe('offre gratuite', () => {
    let salon: SalonFixture;
    let token: string;

    beforeEach(async () => {
      salon = await createSalon(ctx.prisma, {
        slug: 'salon-gratuit',
        phone: '+213555400001',
        plan: 'FREE',
      });
      token = await loginAs(server, salon.phone, salon.password);
    });

    it('annonce sa limite au gérant', async () => {
      const response = await quotaOf(token).expect(200);
      const body = response.body as {
        plan: string;
        limit: number;
        used: number;
        remaining: number;
        isExceeded: boolean;
      };

      expect(body.plan).toBe('FREE');
      expect(body.limit).toBe(freeLimit);
      expect(body.used).toBe(0);
      expect(body.remaining).toBe(freeLimit);
      expect(body.isExceeded).toBe(false);
    });

    it('prévient le gérant à 80 % avant de bloquer quoi que ce soit', async () => {
      await fillQuota(salon, Math.ceil(freeLimit * 0.8));

      const response = await quotaOf(token).expect(200);
      const body = response.body as {
        isNearLimit: boolean;
        isExceeded: boolean;
      };

      // L'alerte arrive pendant que les réservations passent encore : le
      // gérant a le temps de réagir avant de perdre une cliente.
      expect(body.isNearLimit).toBe(true);
      expect(body.isExceeded).toBe(false);
      expect((await book(salon)).status).toBe(201);
    });

    it('accepte la dernière réservation du forfait', async () => {
      await fillQuota(salon, freeLimit - 1);

      expect((await book(salon)).status).toBe(201);

      const response = await quotaOf(token).expect(200);
      expect((response.body as { remaining: number }).remaining).toBe(0);
    });

    it('refuse la réservation de trop et renvoie vers le salon', async () => {
      await fillQuota(salon, freeLimit);

      const response = await book(salon);
      expect(response.status).toBe(403);
      const message = (response.body as { message: string }).message;

      // Le message ne reproche rien à la cliente et lui donne une issue : le
      // salon peut toujours la prendre par téléphone. C'est la réservation
      // en ligne qui est bloquée, pas le rendez-vous.
      expect(message).toMatch(/limite de réservations en ligne/i);
      expect(message).toMatch(/téléphone/i);
    });

    it('les annulations ne consomment pas le forfait', async () => {
      await fillQuota(salon, freeLimit);
      await ctx.prisma.reservation.updateMany({
        where: { salonId: salon.salonId },
        data: { status: 'CANCELED' },
      });

      // Un salon dont toutes les clientes se sont décommandées n'a rien
      // consommé : lui facturer ces réservations serait injustifiable.
      const response = await quotaOf(token).expect(200);
      expect((response.body as { used: number }).used).toBe(0);

      expect((await book(salon)).status).toBe(201);
    });
  });

  describe('offre payante', () => {
    it('ne plafonne pas les réservations', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-pro',
        phone: '+213555400002',
        plan: 'PRO',
      });
      const token = await loginAs(server, salon.phone, salon.password);

      await fillQuota(salon, freeLimit + 5);

      const response = await quotaOf(token).expect(200);
      const body = response.body as {
        limit: number | null;
        remaining: number | null;
        isExceeded: boolean;
      };

      expect(body.limit).toBeNull();
      expect(body.remaining).toBeNull();
      expect(body.isExceeded).toBe(false);

      expect((await book(salon)).status).toBe(201);
    });
  });

  describe('plafonds par numéro de téléphone', () => {
    let salon: SalonFixture;

    beforeEach(async () => {
      salon = await createSalon(ctx.prisma, {
        slug: 'salon-antiabus',
        phone: '+213555400003',
        plan: 'PRO',
      });
    });

    /**
     * Ces plafonds vivent en base et non dans le throttler : en Algérie, les
     * opérateurs mobiles partagent les IP publiques entre de nombreux abonnés
     * (CGNAT), donc une limite par IP assez stricte pour gêner un abuseur
     * bloquerait aussi de vraies clientes. Le numéro est la bonne clé.
     */
    it('un même numéro ne peut pas détenir plus de 3 RDV à venir', async () => {
      const availability = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const slots = (availability.body as { slots: { startsAt: string }[] })
        .slots;

      function bookAt(index: number) {
        return request(server)
          .post(api(`/salons/${salon.slug}/reservations`))
          .send({
            startsAt: slots[index * 2].startsAt,
            prestationIds: [salon.prestationId],
            clientFirstName: 'Squatteuse',
            clientPhone: '+213655555555',
          });
      }

      await bookAt(0).expect(201);
      await bookAt(1).expect(201);
      await bookAt(2).expect(201);

      const refused = await bookAt(3).expect(403);
      expect((refused.body as { message: string }).message).toMatch(
        /rendez-vous à venir dans ce salon/i,
      );
    });
  });
});
