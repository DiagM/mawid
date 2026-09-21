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
 * Rappels de la veille
 * ============================================
 * Le no-show est le problème numéro un des rendez-vous en beauté, et les
 * statistiques du salon le mesurent déjà — sans qu'aucun outil ne le
 * combatte. Le fichier `.ics` remis à la réservation ne suffit pas : peu de
 * gens l'ouvrent.
 *
 * Aucun envoi automatique : il se facturerait au message. Le gérant reçoit
 * sa liste du soir, prête, et écrit depuis son propre WhatsApp.
 */
describe('Rappels de la veille (e2e)', () => {
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
      slug: 'salon-rappels',
      phone: '+213559000001',
    });
    token = await loginAs(server, salon.phone, salon.password);
  });

  /** Réserve sur un jour donné et renvoie l'identifiant du rendez-vous. */
  async function book(
    date: string,
    slotIndex = 0,
    phone = '+213668000001',
  ): Promise<string> {
    const availability = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    const slot = (availability.body as { slots: { startsAt: string }[] }).slots[
      slotIndex
    ].startsAt;

    const response = await request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt: slot,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Amina',
        clientPhone: phone,
      })
      .expect(201);

    return (response.body as { id: string }).id;
  }

  function reminders(date?: string) {
    const req = request(server)
      .get(api('/reservations/reminders'))
      .set('Authorization', `Bearer ${token}`);

    return date ? req.query({ from: date }) : req;
  }

  it('propose les rendez-vous de demain par défaut', async () => {
    const tomorrow = futureLocalDate(1);
    await book(tomorrow);
    // Un rendez-vous d'après-demain ne doit pas s'y glisser.
    await book(futureLocalDate(2), 0, '+213668000002');

    const response = await reminders().expect(200);
    const body = response.body as {
      date: string;
      items: { clientFirstName: string; localTime: string }[];
    };

    expect(body.date).toBe(tomorrow);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].localTime).toBe('09:00');
  });

  it('accepte un autre jour', async () => {
    const target = futureLocalDate(4);
    await book(target);

    const response = await reminders(target).expect(200);
    expect((response.body as { items: unknown[] }).items).toHaveLength(1);
  });

  it('donne de quoi écrire : numéro, heure, prestation et lien de gestion', async () => {
    await book(futureLocalDate(1));

    const response = await reminders().expect(200);
    const item = (
      response.body as {
        items: {
          clientPhone: string;
          prestations: string;
          cancellationToken: string;
          remindedAt: string | null;
        }[];
      }
    ).items[0];

    expect(item.clientPhone).toBe('+213668000001');
    expect(item.prestations).toBe('Coupe');
    expect(item.remindedAt).toBeNull();
    // Le lien permet à la cliente de se décommander seule plutôt que de ne
    // pas venir : c'est ce qui récupère le créneau.
    expect(item.cancellationToken).toEqual(expect.any(String));
  });

  it('ignore les rendez-vous annulés', async () => {
    const tomorrow = futureLocalDate(1);
    const id = await book(tomorrow);

    await request(server)
      .patch(api(`/reservations/${id}/status`))
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELED' })
      .expect(200);

    // Rappeler un rendez-vous annulé ferait passer le salon pour
    // désorganisé.
    const response = await reminders().expect(200);
    expect((response.body as { items: unknown[] }).items).toEqual([]);
  });

  it('garde la trace d’un rappel envoyé', async () => {
    const id = await book(futureLocalDate(1));

    await request(server)
      .patch(api(`/reservations/${id}/reminded`))
      .set('Authorization', `Bearer ${token}`)
      .send({ reminded: true })
      .expect(200);

    const response = await reminders().expect(200);
    const item = (response.body as { items: { remindedAt: string | null }[] })
      .items[0];

    // Sans cette trace, un gérant interrompu recommencerait au début et
    // écrirait deux fois aux mêmes clientes.
    expect(item.remindedAt).not.toBeNull();
  });

  it('permet de revenir en arrière', async () => {
    const id = await book(futureLocalDate(1));

    const markReminded = (reminded: boolean) =>
      request(server)
        .patch(api(`/reservations/${id}/reminded`))
        .set('Authorization', `Bearer ${token}`)
        .send({ reminded })
        .expect(200);

    await markReminded(true);
    await markReminded(false);

    const response = await reminders().expect(200);
    expect(
      (response.body as { items: { remindedAt: string | null }[] }).items[0]
        .remindedAt,
    ).toBeNull();
  });

  it('n’affecte pas le statut du rendez-vous', async () => {
    const id = await book(futureLocalDate(1));

    await request(server)
      .patch(api(`/reservations/${id}/reminded`))
      .set('Authorization', `Bearer ${token}`)
      .send({ reminded: true })
      .expect(200);

    const agenda = await request(server)
      .get(api('/reservations/me'))
      .query({ from: futureLocalDate(1), to: futureLocalDate(1) })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Rappeler n'est pas qualifier : le statut reste au gérant, après coup.
    expect((agenda.body as { status: string }[])[0].status).toBe('CONFIRMED');
  });

  describe('isolation', () => {
    it('ne montre que les rendez-vous de son salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213559000002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      await book(futureLocalDate(1));

      const response = await request(server)
        .get(api('/reservations/reminders'))
        .set('Authorization', `Bearer ${autreToken}`)
        .expect(200);

      expect((response.body as { items: unknown[] }).items).toEqual([]);
    });

    it('refuse de marquer le rendez-vous d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213559000002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      const id = await book(futureLocalDate(1));

      await request(server)
        .patch(api(`/reservations/${id}/reminded`))
        .set('Authorization', `Bearer ${autreToken}`)
        .send({ reminded: true })
        .expect(403);
    });

    it('exige une authentification', async () => {
      await request(server).get(api('/reservations/reminders')).expect(401);
    });
  });

  describe('offre', () => {
    it('reste ouvert en offre Gratuite', async () => {
      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { plan: 'FREE' },
      });

      // Le no-show frappe d'abord les petits salons : en faire un privilège
      // payant reviendrait à vendre la réparation d'un problème qu'on laisse
      // grandir.
      await book(futureLocalDate(1));
      await reminders().expect(200);
    });
  });
});
