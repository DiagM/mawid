import request from 'supertest';
import type { App } from 'supertest/types';
import {
  api,
  createTestApp,
  resetDatabase,
  type TestContext,
} from './helpers/app';
import {
  createSalon,
  futureLocalDate,
  type SalonFixture,
} from './helpers/fixtures';

/**
 * Parcours client, de la recherche de créneau à l'annulation.
 *
 * C'est le chemin qui fait vivre le produit : s'il casse, plus rien n'a
 * d'importance. Chaque scénario part d'une base vide pour rester lisible
 * isolément.
 */
describe('Parcours de réservation (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;
  let date: string;

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
      slug: 'salon-test',
      phone: '+213555100001',
    });
    date = futureLocalDate();
  });

  /** Premier créneau libre du jour, tel que le client le verrait. */
  async function firstSlot(): Promise<string> {
    const response = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    const body = response.body as { slots: { startsAt: string }[] };
    return body.slots[0].startsAt;
  }

  function book(startsAt: string, phone = '+213555987654') {
    return request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Amine',
        clientPhone: phone,
      });
  }

  describe('disponibilité', () => {
    it('propose des créneaux alignés sur la grille de 15 minutes', async () => {
      const response = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const body = response.body as {
        totalDurationMinutes: number;
        slots: { startsAt: string; localTime: string }[];
      };

      expect(body.totalDurationMinutes).toBe(30);
      expect(body.slots[0].localTime).toBe('09:00');
      expect(body.slots[1].localTime).toBe('09:15');
      // 17:30 + 30 min = 18:00, l'heure de fermeture pile.
      expect(body.slots[body.slots.length - 1].localTime).toBe('17:30');
    });

    it('refuse une prestation appartenant à un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213555100002',
      });

      await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: autre.prestationId })
        .expect(404);
    });

    it("refuse une date au-delà de l'horizon", async () => {
      await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date: futureLocalDate(60), prestationIds: salon.prestationId })
        .expect(400);
    });
  });

  describe('création', () => {
    it('crée la réservation et renvoie le lien de gestion', async () => {
      const slot = await firstSlot();
      const response = await book(slot).expect(201);

      const body = response.body as {
        cancellationToken: string;
        totalPriceCents: number;
        localTime: string;
      };

      expect(body.totalPriceCents).toBe(80000);
      expect(body.localTime).toBe('09:00');
      // Le token n'est remis qu'ici : c'est le seul moyen pour le client de
      // revenir sur son rendez-vous sans compte.
      expect(body.cancellationToken).toEqual(expect.any(String));
    });

    it('refuse un prix imposé par le client', async () => {
      const slot = await firstSlot();

      // `forbidNonWhitelisted` rejette le champ inconnu. Ce test garde donc
      // deux choses à la fois : qu'on ne peut pas négocier son prix, et que
      // le ValidationPipe est bien actif dans l'application testée.
      await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: slot,
          prestationIds: [salon.prestationId],
          clientFirstName: 'Amine',
          clientPhone: '+213555987654',
          totalPriceCents: 1,
        })
        .expect(400);
    });

    it('retire le créneau des disponibilités une fois pris', async () => {
      const slot = await firstSlot();
      await book(slot).expect(201);

      const response = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const body = response.body as { slots: { startsAt: string }[] };
      expect(body.slots.map((s) => s.startsAt)).not.toContain(slot);
    });

    it('refuse un numéro non algérien', async () => {
      const slot = await firstSlot();
      await book(slot, '+33612345678').expect(400);
    });

    it('refuse un honeypot rempli', async () => {
      const slot = await firstSlot();

      await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: slot,
          prestationIds: [salon.prestationId],
          clientFirstName: 'Bot',
          clientPhone: '+213555987654',
          website: 'http://spam.example',
        })
        .expect(400);
    });

    it('refuse un créneau hors de la grille', async () => {
      const slot = await firstSlot();
      const offGrid = new Date(
        new Date(slot).getTime() + 7 * 60 * 1000,
      ).toISOString();

      await book(offGrid).expect(400);
    });
  });

  describe('gestion par token', () => {
    async function bookAndGetToken(): Promise<string> {
      const slot = await firstSlot();
      const response = await book(slot).expect(201);
      return (response.body as { cancellationToken: string }).cancellationToken;
    }

    it("n'expose ni le token ni la note interne en lecture", async () => {
      const token = await bookAndGetToken();

      const response = await request(server)
        .get(api(`/reservations/token/${token}`))
        .expect(200);

      const body = response.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('cancellationToken');
      expect(body).not.toHaveProperty('internalNote');
      expect(body.salon).toBeDefined();
    });

    it('annule et libère le créneau', async () => {
      const slot = await firstSlot();
      const response = await book(slot).expect(201);
      const token = (response.body as { cancellationToken: string })
        .cancellationToken;

      await request(server)
        .delete(api(`/reservations/token/${token}`))
        .expect(200);

      // Le créneau redevient disponible : la contrainte d'exclusion ne porte
      // que sur les réservations CONFIRMED.
      const after = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const slots = (after.body as { slots: { startsAt: string }[] }).slots;
      expect(slots.map((s) => s.startsAt)).toContain(slot);
    });

    it('refuse une seconde annulation', async () => {
      const token = await bookAndGetToken();

      await request(server)
        .delete(api(`/reservations/token/${token}`))
        .expect(200);
      await request(server)
        .delete(api(`/reservations/token/${token}`))
        .expect(400);
    });

    it('renvoie 404 sur un token inconnu', async () => {
      await request(server)
        .get(api('/reservations/token/jeton-invente'))
        .expect(404);
    });
  });
});
