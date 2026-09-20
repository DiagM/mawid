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
 * Liste d'attente
 * ============================================
 * Quand un jour est complet, la cliente repartait sans laisser de trace :
 * du chiffre d'affaires perdu pour le salon, un client perdu pour la
 * plateforme.
 *
 * Aucune notification automatique — elle se facturerait au message. C'est le
 * gérant qui rappelle, depuis son agenda. Ce fichier verrouille surtout la
 * règle qui empêche la liste de devenir un second canal de réservation :
 * **on ne s'inscrit que si la journée est réellement complète.**
 */
describe('Liste d’attente (e2e)', () => {
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
      slug: 'salon-attente',
      phone: '+213558000001',
    });
    managerToken = await loginAs(server, salon.phone, salon.password);
    date = futureLocalDate();
  });

  /**
   * Remplit la journée en bloquant toute la plage d'ouverture.
   *
   * Plus fidèle qu'une série de réservations, et surtout plus rapide : ce
   * qui compte ici est qu'aucun créneau ne reste libre.
   */
  async function fillDay() {
    await request(server)
      .post(api('/blocked-slots'))
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        startsAt: `${date}T06:00:00.000Z`,
        endsAt: `${date}T20:00:00.000Z`,
        reason: 'Complet',
      })
      .expect(201);
  }

  function join(body: Record<string, unknown> = {}) {
    return request(server)
      .post(api(`/salons/${salon.slug}/waitlist`))
      .send({
        desiredDate: date,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Amina',
        clientPhone: '+213666100001',
        ...body,
      });
  }

  function asManager(method: 'get' | 'patch' | 'delete', path: string) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${managerToken}`);
  }

  describe('inscription', () => {
    it('refuse tant qu’un créneau reste libre', async () => {
      const response = await join().expect(400);

      // Sans ce contrôle, la liste deviendrait un second canal de
      // réservation et le gérant rappellerait des clientes qui auraient pu
      // réserver seules.
      expect((response.body as { message: string }).message).toMatch(
        /créneaux sont encore libres/i,
      );
    });

    it('accepte quand la journée est complète', async () => {
      await fillDay();

      const response = await join({ note: 'Plutôt le matin' }).expect(201);
      expect((response.body as { desiredDate: string }).desiredDate).toBe(date);
    });

    it('ne crée pas de doublon si la cliente s’inscrit deux fois', async () => {
      await fillDay();

      await join().expect(201);
      await join({ note: 'Après 17h' }).expect(201);

      const list = await asManager('get', '/waitlist').expect(200);
      const items = list.body as { note: string | null }[];

      // Rafraîchir la page ne doit pas créer une ligne que le gérant
      // devrait démêler ; la dernière précision fait foi.
      expect(items).toHaveLength(1);
      expect(items[0].note).toBe('Après 17h');
    });

    it('refuse un honeypot rempli', async () => {
      await fillDay();

      await join({ website: 'http://spam.example' }).expect(400);
    });

    it('refuse un numéro non algérien', async () => {
      await fillDay();

      await join({ clientPhone: '+33612345678' }).expect(400);
    });

    it('plafonne le nombre de demandes d’un même numéro', async () => {
      const days = [1, 2, 3, 4].map((offset) => futureLocalDate(offset));

      for (const day of days) {
        await request(server)
          .post(api('/blocked-slots'))
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            startsAt: `${day}T06:00:00.000Z`,
            endsAt: `${day}T20:00:00.000Z`,
          })
          .expect(201);
      }

      for (const day of days.slice(0, 3)) {
        await join({ desiredDate: day }).expect(201);
      }

      // Le gérant lit cette liste à la main : l'inonder la rend inutile.
      await join({ desiredDate: days[3] }).expect(403);
    });

    it('refuse une cliente bloquée par le salon, sans le lui dire', async () => {
      await fillDay();
      await join().expect(201);

      // Elle n'a aucune réservation : la liste de clientèle est construite
      // sur les rendez-vous, donc elle n'y figure pas encore. Le blocage
      // accepte néanmoins une cliente connue par la seule liste d'attente.
      const entry = await ctx.prisma.waitlistEntry.findFirstOrThrow({
        where: { salonId: salon.salonId },
        select: { clientId: true },
      });
      const clientId = entry.clientId;

      await asManager('patch', `/clients/${clientId}/blocked`)
        .send({ isBlocked: true })
        .expect(200);

      const refused = await join();
      expect(refused.status).toBe(403);

      // La liste d'attente ne doit pas devenir l'oracle qui révèle un
      // blocage que la réservation, elle, garde secret.
      expect((refused.body as { message: string }).message).not.toMatch(
        /bloqu/i,
      );
    });

    it('refuse une prestation d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213558000002',
      });
      await fillDay();

      await join({ prestationIds: [autre.prestationId] }).expect(404);
    });
  });

  describe('vue du gérant', () => {
    it('affiche la demande avec sa durée et son ordre d’arrivée', async () => {
      await fillDay();
      await join().expect(201);
      await join({
        clientPhone: '+213666100002',
        clientFirstName: 'Sarah',
      }).expect(201);

      const list = await asManager('get', '/waitlist').expect(200);
      const items = list.body as {
        clientFirstName: string;
        prestationsSummary: string;
        durationMinutes: number;
        notifiedAt: string | null;
      }[];

      expect(items).toHaveLength(2);
      // Premier inscrit, premier rappelé : la seule règle équitable.
      expect(items[0].clientFirstName).toBe('Amina');
      expect(items[0].prestationsSummary).toBe('Coupe');
      expect(items[0].durationMinutes).toBe(30);
      expect(items[0].notifiedAt).toBeNull();
    });

    it('ne montre pas les jours passés', async () => {
      await fillDay();
      await join().expect(201);

      const list = await asManager('get', '/waitlist')
        .query({ from: futureLocalDate(10), to: futureLocalDate(20) })
        .expect(200);

      expect(list.body).toEqual([]);
    });

    it('garde la trace d’un rappel déjà fait', async () => {
      await fillDay();
      await join().expect(201);

      const list = await asManager('get', '/waitlist').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await asManager('patch', `/waitlist/${id}`)
        .send({ notified: true })
        .expect(200);

      const after = await asManager('get', '/waitlist').expect(200);

      // Sans trace, le gérant rappellerait deux fois la même personne.
      expect(
        (after.body as { notifiedAt: string | null }[])[0].notifiedAt,
      ).not.toBeNull();
    });

    it('permet de retirer une demande', async () => {
      await fillDay();
      await join().expect(201);

      const list = await asManager('get', '/waitlist').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await asManager('delete', `/waitlist/${id}`).expect(204);
      expect((await asManager('get', '/waitlist').expect(200)).body).toEqual(
        [],
      );
    });
  });

  describe('isolation', () => {
    it('un gérant ne voit pas la liste d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213558000002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      await fillDay();
      await join().expect(201);

      const list = await request(server)
        .get(api('/waitlist'))
        .set('Authorization', `Bearer ${autreToken}`)
        .expect(200);

      expect(list.body).toEqual([]);
    });

    it('un gérant ne peut pas toucher à la demande d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213558000002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      await fillDay();
      await join().expect(201);

      const list = await asManager('get', '/waitlist').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await request(server)
        .patch(api(`/waitlist/${id}`))
        .set('Authorization', `Bearer ${autreToken}`)
        .send({ notified: true })
        .expect(403);

      await request(server)
        .delete(api(`/waitlist/${id}`))
        .set('Authorization', `Bearer ${autreToken}`)
        .expect(403);
    });

    it('exige une authentification', async () => {
      await request(server).get(api('/waitlist')).expect(401);
    });
  });
});
