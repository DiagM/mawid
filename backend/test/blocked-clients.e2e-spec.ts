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
 * Blocage d'une cliente par un salon
 * ============================================
 * Sans OTP SMS, un gérant qui subit trois lapins du même numéro n'avait
 * jusqu'ici aucun recours : `Client.isBlocked` existait, était vérifié à la
 * réservation, s'affichait en badge — et aucune route ne permettait de
 * l'activer.
 *
 * Le blocage ajouté est **local au salon**. `Client.isBlocked` reste le
 * bannissement de la plateforme, décidé par Mawid : laisser un salon exclure
 * quelqu'un de tous les autres lui donnerait un pouvoir qui n'est pas le
 * sien. La dernière section de ce fichier verrouille cette frontière.
 */
describe('Blocage d’une cliente (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salonA: SalonFixture;
  let salonB: SalonFixture;
  let tokenA: string;
  let date: string;

  const CLIENT_PHONE = '+213663000001';

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
      phone: '+213556000001',
    });
    salonB = await createSalon(ctx.prisma, {
      slug: 'salon-b',
      phone: '+213556000002',
    });

    tokenA = await loginAs(server, salonA.phone, salonA.password);
    date = futureLocalDate();
  });

  /**
   * Réserve dans un salon et renvoie la réponse brute.
   *
   * Renvoie la réponse et non l'objet supertest : la fonction doit d'abord
   * lire les créneaux, elle est donc `async` et `.expect()` ne peut pas s'y
   * enchaîner.
   */
  async function book(
    salon: SalonFixture,
    slotIndex = 0,
  ): Promise<request.Response> {
    const availability = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    const slot = (availability.body as { slots: { startsAt: string }[] }).slots[
      slotIndex
    ].startsAt;

    return request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt: slot,
        prestationIds: [salon.prestationId],
        clientFirstName: 'Amina',
        clientPhone: CLIENT_PHONE,
      });
  }

  /** Identifiant de la cliente, tel que le gérant le voit dans sa liste. */
  async function clientIdOf(token: string): Promise<string> {
    const response = await request(server)
      .get(api('/clients'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return (response.body as { items: { id: string }[] }).items[0].id;
  }

  function setBlocked(
    token: string,
    clientId: string,
    isBlocked: boolean,
    reason?: string,
  ) {
    return request(server)
      .patch(api(`/clients/${clientId}/blocked`))
      .set('Authorization', `Bearer ${token}`)
      .send({ isBlocked, ...(reason && { reason }) });
  }

  it('empêche la cliente bloquée de réserver', async () => {
    expect((await book(salonA)).status).toBe(201);
    const clientId = await clientIdOf(tokenA);

    await setBlocked(tokenA, clientId, true, 'Trois lapins').expect(200);

    const refused = await book(salonA, 2);
    expect(refused.status).toBe(403);

    // Message neutre : confirmer à quelqu'un qu'il est bloqué lui apprend
    // seulement à changer de numéro.
    const message = (refused.body as { message: string }).message;
    expect(message).toMatch(/Contactez directement le salon/i);
    expect(message).not.toMatch(/bloqu/i);
  });

  it('laisse réserver à nouveau après déblocage', async () => {
    expect((await book(salonA)).status).toBe(201);
    const clientId = await clientIdOf(tokenA);

    await setBlocked(tokenA, clientId, true).expect(200);
    expect((await book(salonA, 2)).status).toBe(403);

    await setBlocked(tokenA, clientId, false).expect(200);
    expect((await book(salonA, 2)).status).toBe(201);
  });

  it('conserve le motif et l’expose au gérant', async () => {
    expect((await book(salonA)).status).toBe(201);
    const clientId = await clientIdOf(tokenA);

    await setBlocked(tokenA, clientId, true, 'Trois lapins').expect(200);

    const detail = await request(server)
      .get(api(`/clients/${clientId}`))
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = detail.body as {
      isBlockedHere: boolean;
      blockReason: string | null;
    };
    expect(body.isBlockedHere).toBe(true);
    expect(body.blockReason).toBe('Trois lapins');
  });

  it('est idempotent dans les deux sens', async () => {
    expect((await book(salonA)).status).toBe(201);
    const clientId = await clientIdOf(tokenA);

    await setBlocked(tokenA, clientId, true).expect(200);
    await setBlocked(tokenA, clientId, true).expect(200);
    await setBlocked(tokenA, clientId, false).expect(200);
    // Débloquer quelqu'un qui ne l'était pas ne doit pas échouer.
    await setBlocked(tokenA, clientId, false).expect(200);
  });

  it('n’annule pas les rendez-vous déjà pris', async () => {
    const existing = await book(salonA);
    expect(existing.status).toBe(201);
    const clientId = await clientIdOf(tokenA);

    await setBlocked(tokenA, clientId, true).expect(200);

    // Bloquer regarde l'avenir. Annuler d'office un RDV confirmé, sans
    // prévenir la cliente qui se présenterait quand même, serait pire que
    // le problème qu'on cherche à régler.
    const token = (existing.body as { cancellationToken: string })
      .cancellationToken;
    const reservation = await request(server)
      .get(api(`/reservations/token/${token}`))
      .expect(200);

    expect((reservation.body as { status: string }).status).toBe('CONFIRMED');
  });

  describe('le blocage ne déborde pas', () => {
    it('ne concerne que le salon qui l’a décidé', async () => {
      expect((await book(salonA)).status).toBe(201);
      const clientId = await clientIdOf(tokenA);

      await setBlocked(tokenA, clientId, true).expect(200);

      // Le salon B n'a rien décidé : la cliente doit pouvoir y réserver.
      expect((await book(salonB)).status).toBe(201);
    });

    it('ne touche pas au bannissement de la plateforme', async () => {
      expect((await book(salonA)).status).toBe(201);
      const clientId = await clientIdOf(tokenA);

      await setBlocked(tokenA, clientId, true).expect(200);

      const client = await ctx.prisma.client.findUniqueOrThrow({
        where: { id: clientId },
        select: { isBlocked: true },
      });

      // `Client.isBlocked` relève de Mawid seul.
      expect(client.isBlocked).toBe(false);
    });

    it('un bannissement plateforme ferme en revanche tous les salons', async () => {
      expect((await book(salonA)).status).toBe(201);
      const clientId = await clientIdOf(tokenA);

      await ctx.prisma.client.update({
        where: { id: clientId },
        data: { isBlocked: true },
      });

      expect((await book(salonA, 2)).status).toBe(403);
      expect((await book(salonB)).status).toBe(403);
    });

    it('refuse à un gérant de bloquer une cliente qu’il n’a jamais reçue', async () => {
      expect((await book(salonB)).status).toBe(201);
      const tokenB = await loginAs(server, salonB.phone, salonB.password);
      const clientId = await clientIdOf(tokenB);

      // Sans ce contrôle, un gérant pourrait sonder des identifiants pour
      // découvrir qui fréquente la plateforme.
      await setBlocked(tokenA, clientId, true).expect(404);
    });
  });

  describe('offre', () => {
    it('est réservé aux offres qui ouvrent la clientèle', async () => {
      expect((await book(salonA)).status).toBe(201);
      const clientId = await clientIdOf(tokenA);

      await ctx.prisma.salon.update({
        where: { id: salonA.salonId },
        data: { plan: 'FREE' },
      });

      await setBlocked(tokenA, clientId, true).expect(403);
    });
  });
});
