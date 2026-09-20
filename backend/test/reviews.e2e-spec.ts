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
 * Avis clients
 * ============================================
 * Le business plan redoutait le « potentiel d'abus » d'un système de notation
 * ouvert : un concurrent qui déverse dix avis à une étoile, un salon qui se
 * note lui-même. La réponse du produit est structurelle et tient en trois
 * verrous, tous vérifiés ici :
 *
 * 1. il faut détenir le `cancellationToken`, remis une seule fois au client ;
 * 2. le rendez-vous doit avoir été qualifié `HONORED` par le gérant ;
 * 3. `reservationId` est unique : un passage, un avis.
 *
 * Et un quatrième, qui protège le client cette fois : le gérant ne dispose
 * d'aucune route pour supprimer ou masquer un avis.
 */
describe('Avis clients (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;
  let managerToken: string;
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
      slug: 'salon-avis',
      phone: '+213555300001',
    });
    managerToken = await loginAs(server, salon.phone, salon.password);
    date = futureLocalDate();
  });

  /**
   * Réserve un créneau et renvoie de quoi agir dessus des deux côtés :
   * le token côté client, l'identifiant côté gérant.
   */
  async function book(
    index = 0,
  ): Promise<{ token: string; reservationId: string }> {
    const availability = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    const slot = (availability.body as { slots: { startsAt: string }[] }).slots[
      index
    ].startsAt;

    const response = await request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt: slot,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Lina',
        clientPhone: `+21366430000${index}`,
      })
      .expect(201);

    const body = response.body as { id: string; cancellationToken: string };
    return { token: body.cancellationToken, reservationId: body.id };
  }

  /** Le gérant qualifie le rendez-vous comme honoré. */
  async function markHonored(reservationId: string) {
    await request(server)
      .patch(api(`/reservations/${reservationId}/status`))
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'HONORED' })
      .expect(200);
  }

  function postReview(token: string, body: Record<string, unknown>) {
    return request(server)
      .post(api(`/reservations/token/${token}/review`))
      .send(body);
  }

  describe('il faut être réellement venu', () => {
    it('un rendez-vous seulement confirmé ne peut pas être noté', async () => {
      const { token } = await book();

      await postReview(token, { rating: 5 }).expect(400);
    });

    it('un rendez-vous honoré peut être noté', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      const response = await postReview(token, {
        rating: 5,
        comment: 'Parfait, je reviendrai.',
      }).expect(201);

      const body = response.body as { rating: number; comment: string };
      expect(body.rating).toBe(5);
      expect(body.comment).toBe('Parfait, je reviendrai.');
    });

    it('un token inventé ne permet pas de noter', async () => {
      await postReview('jeton-invente', { rating: 1 }).expect(404);
    });

    it('un rendez-vous annulé ne peut pas être noté', async () => {
      const { token } = await book();

      await request(server)
        .delete(api(`/reservations/token/${token}`))
        .expect(200);

      await postReview(token, { rating: 1 }).expect(400);
    });
  });

  describe('un passage, un avis', () => {
    it('le deuxième avis sur le même rendez-vous est refusé', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      await postReview(token, { rating: 5 }).expect(201);
      // Sans l'unicité sur `reservationId`, un seul passage suffirait à
      // publier autant d'avis qu'on veut.
      await postReview(token, { rating: 1 }).expect(409);
    });

    it('la page de gestion signale qu’un avis a déjà été laissé', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      const before = await request(server)
        .get(api(`/reservations/token/${token}`))
        .expect(200);
      expect((before.body as { hasReview: boolean }).hasReview).toBe(false);

      await postReview(token, { rating: 4 }).expect(201);

      const after = await request(server)
        .get(api(`/reservations/token/${token}`))
        .expect(200);
      expect((after.body as { hasReview: boolean }).hasReview).toBe(true);
    });
  });

  describe('validation', () => {
    it.each([0, 6, -1, 2.5])('refuse la note %s', async (rating) => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      await postReview(token, { rating }).expect(400);
    });

    it('refuse un honeypot rempli', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      await postReview(token, {
        rating: 5,
        website: 'http://spam.example',
      }).expect(400);
    });

    it('refuse un identifiant de salon imposé', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);

      // Le salon noté est déduit de la réservation. Accepter un `salonId`
      // permettrait de noter n'importe quel salon depuis son propre RDV.
      await postReview(token, { rating: 5, salonId: 'autre' }).expect(400);
    });
  });

  describe('affichage public', () => {
    it('publie la note, la moyenne et le prénom du client', async () => {
      const first = await book(0);
      await markHonored(first.reservationId);
      await postReview(first.token, { rating: 5, comment: 'Top' }).expect(201);

      const second = await book(2);
      await markHonored(second.reservationId);
      await postReview(second.token, { rating: 4 }).expect(201);

      const response = await request(server)
        .get(api(`/salons/${salon.slug}/reviews`))
        .expect(200);

      const body = response.body as {
        average: number;
        count: number;
        items: { rating: number; clientFirstName: string }[];
      };

      expect(body.count).toBe(2);
      expect(body.average).toBe(4.5);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].clientFirstName).toBe('Lina');
    });

    it('un salon sans avis renvoie une moyenne nulle et non zéro', async () => {
      const response = await request(server)
        .get(api(`/salons/${salon.slug}/reviews`))
        .expect(200);

      const body = response.body as { average: number | null; count: number };

      // `null` et non `0` : afficher « 0/5 » à un salon qui n'a simplement
      // pas encore d'avis serait un mensonge qui lui coûte des clients.
      expect(body.average).toBeNull();
      expect(body.count).toBe(0);
    });
  });

  describe('le gérant ne peut pas censurer', () => {
    it('il voit ses avis mais ne dispose d’aucune route pour les retirer', async () => {
      const { token, reservationId } = await book();
      await markHonored(reservationId);
      const created = await postReview(token, { rating: 2 }).expect(201);
      const reviewId = (created.body as { id: string }).id;

      const mine = await request(server)
        .get(api('/reviews/me'))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect((mine.body as { items: unknown[] }).items).toHaveLength(1);

      // Si cette route existait un jour, le système d'avis perdrait toute
      // valeur : un salon pourrait masquer ses mauvaises notes.
      await request(server)
        .delete(api(`/reviews/${reviewId}`))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404);

      const stillPublic = await request(server)
        .get(api(`/salons/${salon.slug}/reviews`))
        .expect(200);
      expect((stillPublic.body as { count: number }).count).toBe(1);
    });
  });
});
