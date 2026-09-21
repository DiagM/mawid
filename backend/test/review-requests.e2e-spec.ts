import request from 'supertest';
import type { App } from 'supertest/types';
import {
  api,
  createTestApp,
  loginAs,
  resetDatabase,
  type TestContext,
} from './helpers/app';
import { createSalon, type SalonFixture } from './helpers/fixtures';

/**
 * ============================================
 * Demandes d'avis
 * ============================================
 * La notation existait déjà, mais restait lettre morte : une cliente ne
 * retourne pas d'elle-même sur un lien reçu trois jours plus tôt, et le seul
 * message du produit — le rappel — part AVANT la visite.
 *
 * Cette liste donne au gérant les rendez-vous honorés qui n'ont pas encore
 * d'avis. Comme les rappels, rien ne part automatiquement : il écrit depuis
 * son propre WhatsApp, et le produit ne paie aucun message.
 */

interface RequestItem {
  id: string;
  clientFirstName: string;
  cancellationToken: string;
  reviewRequestedAt: string | null;
  prestations: string;
}

function items(response: request.Response): RequestItem[] {
  return (response.body as { items: RequestItem[] }).items;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Demandes d'avis (e2e)", () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;
  let token: string;

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
      phone: '+213559100001',
    });
    token = await loginAs(server, salon.phone, salon.password);
  });

  /**
   * Rendez-vous PASSÉ, créé directement en base.
   *
   * Le tunnel public refuse une date passée, à juste titre. Or c'est
   * exactement ce qu'il faut ici : la demande d'avis ne concerne que des
   * visites déjà faites.
   */
  async function pastReservation(options: {
    target?: SalonFixture;
    daysAgo: number;
    status?: 'HONORED' | 'CONFIRMED' | 'NO_SHOW';
    firstName?: string;
    phone?: string;
  }): Promise<string> {
    const target = options.target ?? salon;
    const phone = options.phone ?? '+213669100001';

    const client = await ctx.prisma.client.upsert({
      where: { phone },
      update: {},
      create: { phone, firstName: options.firstName ?? 'Amina' },
    });

    const startsAt = new Date(Date.now() - options.daysAgo * DAY_MS);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

    const reservation = await ctx.prisma.reservation.create({
      data: {
        salonId: target.salonId,
        clientId: client.id,
        clientFirstName: options.firstName ?? 'Amina',
        clientPhone: phone,
        startsAt,
        endsAt,
        status: options.status ?? 'HONORED',
        reservationPrestations: {
          create: {
            prestationId: target.prestationId,
            nameSnapshot: 'Coupe',
            priceCentsSnapshot: 80000,
            durationMinutesSnapshot: 30,
          },
        },
      },
      select: { id: true },
    });

    return reservation.id;
  }

  function list(withToken = token): request.Test {
    return request(server)
      .get(api('/reservations/review-requests'))
      .set('Authorization', `Bearer ${withToken}`);
  }

  describe('qui figure dans la liste', () => {
    it('propose un rendez-vous honoré sans avis', async () => {
      await pastReservation({ daysAgo: 2, firstName: 'Amina' });

      const response = await list().expect(200);

      expect(items(response)).toHaveLength(1);
      expect(items(response)[0].clientFirstName).toBe('Amina');
      expect(items(response)[0].prestations).toBe('Coupe');
    });

    it('écarte un rendez-vous non honoré', async () => {
      // Le client n'a pas le droit de noter tant que le salon n'a pas
      // qualifié la visite : proposer le lien afficherait un refus.
      await pastReservation({ daysAgo: 2, status: 'CONFIRMED' });

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(0);
    });

    it('écarte une absence', async () => {
      await pastReservation({ daysAgo: 2, status: 'NO_SHOW' });

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(0);
    });

    it('écarte un rendez-vous déjà noté', async () => {
      // Redemander un avis à quelqu'un qui en a laissé un est au mieux
      // inutile, au pire agaçant.
      const id = await pastReservation({ daysAgo: 2 });
      const reservation = await ctx.prisma.reservation.findUniqueOrThrow({
        where: { id },
        select: { clientId: true, salonId: true },
      });

      await ctx.prisma.review.create({
        data: {
          reservationId: id,
          salonId: reservation.salonId,
          clientId: reservation.clientId,
          rating: 5,
        },
      });

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(0);
    });

    it('écarte une visite trop ancienne', async () => {
      // 20 jours : hors de la fenêtre de 14. Une cliente ne se souvient plus
      // d'une coupe d'il y a trois semaines, et un avis vague dessert le
      // salon autant qu'une absence d'avis.
      await pastReservation({ daysAgo: 20 });

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(0);
    });

    it('classe la visite la plus récente en premier', async () => {
      await pastReservation({
        daysAgo: 10,
        firstName: 'Ancienne',
        phone: '+213669100002',
      });
      await pastReservation({
        daysAgo: 1,
        firstName: 'Recente',
        phone: '+213669100003',
      });

      const response = await list().expect(200);

      expect(items(response)[0].clientFirstName).toBe('Recente');
      expect(items(response)[1].clientFirstName).toBe('Ancienne');
    });
  });

  describe('suivi des demandes envoyées', () => {
    it('retient qu’une demande a été envoyée', async () => {
      // Sans cette trace, un gérant interrompu au milieu de sa liste
      // recommencerait au début et écrirait deux fois aux mêmes.
      const id = await pastReservation({ daysAgo: 2 });

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({ requested: true })
        .expect(200);

      const response = await list().expect(200);
      expect(items(response)[0].reviewRequestedAt).not.toBeNull();
    });

    it('permet de revenir en arrière', async () => {
      const id = await pastReservation({ daysAgo: 2 });

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({ requested: true })
        .expect(200);

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({ requested: false })
        .expect(200);

      const response = await list().expect(200);
      expect(items(response)[0].reviewRequestedAt).toBeNull();
    });

    it('garde dans la liste une demande déjà envoyée', async () => {
      // Elle reste visible tant qu'aucun avis n'est arrivé : c'est la seule
      // façon pour le gérant de relancer une fois, sans deviner.
      const id = await pastReservation({ daysAgo: 2 });

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({ requested: true })
        .expect(200);

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(1);
    });

    it('refuse un booléen manquant', async () => {
      const id = await pastReservation({ daysAgo: 2 });

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe('isolation entre salons', () => {
    let autre: SalonFixture;
    let autreToken: string;

    beforeEach(async () => {
      autre = await createSalon(ctx.prisma, {
        slug: 'salon-avis-b',
        phone: '+213559100002',
      });
      autreToken = await loginAs(server, autre.phone, autre.password);
    });

    it('ne montre jamais les clientes d’un autre salon', async () => {
      await pastReservation({
        target: autre,
        daysAgo: 2,
        firstName: 'ClienteDeB',
        phone: '+213669100009',
      });

      const response = await list().expect(200);
      expect(items(response)).toHaveLength(0);
    });

    it('refuse de marquer le rendez-vous d’un autre salon', async () => {
      const id = await pastReservation({
        target: autre,
        daysAgo: 2,
        phone: '+213669100010',
      });

      await request(server)
        .patch(api(`/reservations/${id}/review-requested`))
        .set('Authorization', `Bearer ${token}`)
        .send({ requested: true })
        .expect(403);

      // Et la donnée du salon B n'a pas bougé.
      const untouched = await ctx.prisma.reservation.findUniqueOrThrow({
        where: { id },
        select: { reviewRequestedAt: true },
      });
      expect(untouched.reviewRequestedAt).toBeNull();
    });

    it('chaque gérant voit sa propre liste', async () => {
      await pastReservation({ daysAgo: 2, phone: '+213669100011' });
      await pastReservation({
        target: autre,
        daysAgo: 2,
        phone: '+213669100012',
      });

      expect(items(await list().expect(200))).toHaveLength(1);
      expect(items(await list(autreToken).expect(200))).toHaveLength(1);
    });
  });

  it('exige une authentification', async () => {
    await request(server).get(api('/reservations/review-requests')).expect(401);
  });
});
