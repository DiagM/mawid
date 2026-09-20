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
 * Report d'un rendez-vous
 * ============================================
 * Jusqu'ici la cliente ne pouvait qu'annuler. Annuler puis reprendre expose
 * à perdre le créneau entre les deux, sur l'action la plus fréquente après
 * la réservation elle-même.
 *
 * Le report **met à jour** la réservation au lieu d'annuler et recréer.
 * Trois conséquences, toutes vérifiées ici : le lien de gestion déjà envoyé
 * sur WhatsApp reste valable, les prix convenus ne sont pas rejoués, et le
 * quota mensuel du salon n'est pas consommé une seconde fois.
 */
describe('Report d’un rendez-vous (e2e)', () => {
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
      slug: 'salon-report',
      phone: '+213557000001',
    });
    managerToken = await loginAs(server, salon.phone, salon.password);
    date = futureLocalDate();
  });

  async function slots(): Promise<{ startsAt: string; localTime: string }[]> {
    const response = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    return (
      response.body as { slots: { startsAt: string; localTime: string }[] }
    ).slots;
  }

  async function book(
    slotIndex = 0,
    phone = '+213664000001',
  ): Promise<{ id: string; token: string; startsAt: string }> {
    const available = await slots();
    const slot = available[slotIndex];

    const response = await request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt: slot.startsAt,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Amina',
        clientPhone: phone,
      })
      .expect(201);

    const body = response.body as { id: string; cancellationToken: string };
    return {
      id: body.id,
      token: body.cancellationToken,
      startsAt: slot.startsAt,
    };
  }

  function reschedule(token: string, startsAt: string) {
    return request(server)
      .patch(api(`/reservations/token/${token}/reschedule`))
      .send({ startsAt });
  }

  describe('par la cliente', () => {
    it('déplace le rendez-vous en gardant le même lien', async () => {
      const { token, startsAt } = await book(0);
      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;

      const moved = await reschedule(token, target.startsAt).expect(200);
      expect((moved.body as { localTime: string }).localTime).toBe('15:00');

      // Le lien déjà envoyé sur WhatsApp doit continuer de fonctionner :
      // c'est toute la raison de mettre à jour plutôt que de recréer.
      const page = await request(server)
        .get(api(`/reservations/token/${token}`))
        .expect(200);

      const body = page.body as { startsAt: string; localTime: string };
      expect(body.localTime).toBe('15:00');
      expect(body.startsAt).not.toBe(startsAt);
    });

    it('libère l’ancien créneau', async () => {
      const { token, startsAt } = await book(0);
      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;

      await reschedule(token, target.startsAt).expect(200);

      const after = await slots();
      expect(after.map((slot) => slot.startsAt)).toContain(startsAt);
      expect(after.map((slot) => slot.startsAt)).not.toContain(target.startsAt);
    });

    it('ne consomme pas une seconde fois le quota du salon', async () => {
      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { plan: 'FREE' },
      });

      const { token } = await book(0);

      const before = await request(server)
        .get(api('/reservations/quota'))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;
      await reschedule(token, target.startsAt).expect(200);

      const after = await request(server)
        .get(api('/reservations/quota'))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Le quota compte les créations : déplacer n'en est pas une.
      expect((after.body as { used: number }).used).toBe(
        (before.body as { used: number }).used,
      );
    });

    it('ne rejoue pas les prix convenus', async () => {
      const { token } = await book(0);

      await ctx.prisma.prestation.update({
        where: { id: salon.prestationId },
        data: { priceCents: 200000 },
      });

      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;
      const moved = await reschedule(token, target.startsAt).expect(200);

      // Déplacer ne renégocie pas : la cliente garde le tarif de sa
      // réservation initiale, porté par les snapshots.
      expect((moved.body as { totalPriceCents: number }).totalPriceCents).toBe(
        80000,
      );
    });

    it('propose des créneaux incluant celui qu’on libère', async () => {
      const { token, startsAt } = await book(0);

      const options = await request(server)
        .get(api(`/reservations/token/${token}/availability`))
        .query({ date })
        .expect(200);

      // Sans exclusion, le rendez-vous se bloquerait lui-même et la cliente
      // ne pourrait pas le décaler de quinze minutes.
      const available = (options.body as { slots: { startsAt: string }[] })
        .slots;
      expect(available.map((slot) => slot.startsAt)).toContain(startsAt);
    });

    it('accepte un décalage qui chevauche l’ancien créneau', async () => {
      const { token } = await book(0);

      const options = await request(server)
        .get(api(`/reservations/token/${token}/availability`))
        .query({ date })
        .expect(200);

      const target = (
        options.body as { slots: { startsAt: string; localTime: string }[] }
      ).slots.find((slot) => slot.localTime === '09:15')!;

      await reschedule(token, target.startsAt).expect(200);
    });

    it('refuse un créneau déjà pris', async () => {
      const first = await book(0);
      const second = await book(2, '+213664000002');

      const taken = await request(server)
        .get(api(`/reservations/token/${first.token}/availability`))
        .query({ date })
        .expect(200);

      const slotsLeft = (taken.body as { slots: { startsAt: string }[] }).slots;
      expect(slotsLeft.map((s) => s.startsAt)).not.toContain(second.startsAt);

      const response = await reschedule(first.token, second.startsAt);
      expect([400, 409]).toContain(response.status);
    });

    it('refuse un rendez-vous annulé', async () => {
      const { token } = await book(0);
      await request(server)
        .delete(api(`/reservations/token/${token}`))
        .expect(200);

      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;
      await reschedule(token, target.startsAt).expect(400);
    });

    it('refuse un token inconnu', async () => {
      const target = (await slots())[0];
      await reschedule('jeton-invente', target.startsAt).expect(404);
    });

    it('refuse de changer les prestations au passage', async () => {
      const { token } = await book(0);
      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;

      await request(server)
        .patch(api(`/reservations/token/${token}/reschedule`))
        .send({ startsAt: target.startsAt, prestationIds: ['autre'] })
        .expect(400);
    });
  });

  describe('par le gérant', () => {
    it('déplace un rendez-vous de son salon', async () => {
      const { id, token } = await book(0);
      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;

      await request(server)
        .patch(api(`/reservations/${id}/reschedule`))
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ startsAt: target.startsAt })
        .expect(200);

      const page = await request(server)
        .get(api(`/reservations/token/${token}`))
        .expect(200);
      expect((page.body as { localTime: string }).localTime).toBe('15:00');
    });

    it('ne touche pas à un rendez-vous d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213557000002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      const { id } = await book(0);
      const target = (await slots()).find(
        (slot) => slot.localTime === '15:00',
      )!;

      await request(server)
        .patch(api(`/reservations/${id}/reschedule`))
        .set('Authorization', `Bearer ${autreToken}`)
        .send({ startsAt: target.startsAt })
        .expect(403);
    });

    it('exige une authentification', async () => {
      const { id } = await book(0);
      const target = (await slots())[4];

      await request(server)
        .patch(api(`/reservations/${id}/reschedule`))
        .send({ startsAt: target.startsAt })
        .expect(401);
    });
  });
});
