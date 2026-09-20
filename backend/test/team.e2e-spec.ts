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
 * Équipe : horaires individuels et absences
 * ============================================
 * Le produit vend du multi-employés depuis la V2, mais le gérant n'avait
 * aucun moyen de dire que Nadia ne travaille pas le lundi : les horaires
 * individuels existaient dans le moteur et dans l'API sans aucun formulaire,
 * et un jour d'absence fermait le salon entier faute de pouvoir viser une
 * seule personne.
 *
 * Ces tests verrouillent les deux comportements qui comptent :
 * - un membre aux horaires réduits ne se voit proposer que ses heures ;
 * - l'absence d'un membre ne ferme pas le salon.
 */
describe('Équipe et disponibilités (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;
  let token: string;
  let date: string;

  /** Nadia : 09:00–12:00 seulement. Sofia : horaires du salon. */
  let nadiaId: string;
  let sofiaId: string;

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
      slug: 'salon-equipe',
      phone: '+213555900001',
    });
    token = await loginAs(server, salon.phone, salon.password);
    date = futureLocalDate();

    const morningOnly = Object.fromEntries(
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ].map((day) => [day, { open: '09:00', close: '12:00' }]),
    );

    nadiaId = await createEmployee('Nadia', morningOnly);
    sofiaId = await createEmployee('Sofia');
  });

  async function createEmployee(
    fullName: string,
    workingHours?: Record<string, { open: string; close: string }>,
  ): Promise<string> {
    const response = await request(server)
      .post(api('/employees'))
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName, ...(workingHours && { workingHours }) })
      .expect(201);

    return (response.body as { id: string }).id;
  }

  /** Créneaux proposés, en heure locale, pour un membre ou pour le salon. */
  async function slotsFor(employeeId?: string): Promise<string[]> {
    const response = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({
        date,
        prestationIds: salon.prestationId,
        ...(employeeId && { employeeId }),
      })
      .expect(200);

    return (response.body as { slots: { localTime: string }[] }).slots.map(
      (slot) => slot.localTime,
    );
  }

  /**
   * Instant UTC d'une heure locale, déduit des créneaux renvoyés par l'API.
   *
   * Plus fiable qu'un décalage codé en dur : l'Algérie est à UTC+1 toute
   * l'année aujourd'hui, mais un test qui suppose cette constante mentirait
   * le jour où elle changerait.
   */
  async function instantOf(localTime: string): Promise<string> {
    const response = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId, employeeId: sofiaId })
      .expect(200);

    const slot = (
      response.body as { slots: { startsAt: string; localTime: string }[] }
    ).slots.find((entry) => entry.localTime === localTime);

    if (!slot) {
      throw new Error(`Créneau ${localTime} introuvable`);
    }

    return slot.startsAt;
  }

  function blockSlot(body: Record<string, unknown>) {
    return request(server)
      .post(api('/blocked-slots'))
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  // ============================================
  // Horaires individuels
  // ============================================

  describe('horaires individuels', () => {
    it('limite les créneaux d’un membre à ses propres heures', async () => {
      const nadia = await slotsFor(nadiaId);

      expect(nadia[0]).toBe('09:00');
      // 11:30 + 30 min = 12:00, sa fin de service pile.
      expect(nadia[nadia.length - 1]).toBe('11:30');
      expect(nadia).not.toContain('14:00');
    });

    it('n’impose ces heures qu’à ce membre', async () => {
      const sofia = await slotsFor(sofiaId);

      expect(sofia).toContain('14:00');
      expect(sofia[sofia.length - 1]).toBe('17:30');
    });

    it('le salon reste ouvert tant qu’un membre est disponible', async () => {
      // Sans préférence, le client ne doit pas subir les horaires réduits
      // d'un seul membre de l'équipe.
      const salonSlots = await slotsFor();

      expect(salonSlots).toContain('09:00');
      expect(salonSlots).toContain('17:30');
    });

    it('refuse de réserver un membre hors de ses heures', async () => {
      const afternoon = await instantOf('14:00');

      const response = await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: afternoon,
          prestationIds: [salon.prestationId],
          employeeId: nadiaId,
          clientFirstName: 'Amina',
          clientPhone: '+213661000001',
        });

      // Un créneau affiché comme libre ne prouve rien : la revalidation à
      // l'insertion doit refuser ce que la lecture n'a jamais proposé.
      expect([400, 409]).toContain(response.status);
    });

    it('accepte une réservation dans ses heures', async () => {
      const morning = await instantOf('09:00');

      await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: morning,
          prestationIds: [salon.prestationId],
          employeeId: nadiaId,
          clientFirstName: 'Amina',
          clientPhone: '+213661000002',
        })
        .expect(201);
    });

    it('permet de revenir aux horaires du salon', async () => {
      await request(server)
        .patch(api(`/employees/${nadiaId}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ workingHours: null })
        .expect(200);

      const nadia = await slotsFor(nadiaId);
      expect(nadia).toContain('14:00');
    });
  });

  // ============================================
  // Absences individuelles
  // ============================================

  describe('absence d’un membre', () => {
    it('retire ses créneaux sans fermer le salon', async () => {
      const start = await instantOf('09:00');
      const end = await instantOf('11:00');

      await blockSlot({
        startsAt: start,
        endsAt: end,
        employeeId: nadiaId,
        reason: 'Rendez-vous médical',
      }).expect(201);

      const nadia = await slotsFor(nadiaId);
      expect(nadia).not.toContain('09:00');
      expect(nadia).toContain('11:00');

      // Sofia travaille : le salon ne ferme pas parce que Nadia s'absente.
      const sofia = await slotsFor(sofiaId);
      expect(sofia).toContain('09:00');

      const salonSlots = await slotsFor();
      expect(salonSlots).toContain('09:00');
    });

    it('un blocage sans membre ferme bien tout le salon', async () => {
      const start = await instantOf('09:00');
      const end = await instantOf('11:00');

      await blockSlot({
        startsAt: start,
        endsAt: end,
        reason: 'Inventaire',
      }).expect(201);

      expect(await slotsFor(nadiaId)).not.toContain('09:00');
      expect(await slotsFor(sofiaId)).not.toContain('09:00');
      expect(await slotsFor()).not.toContain('09:00');
    });

    it('expose le membre concerné dans la liste', async () => {
      const start = await instantOf('09:00');
      const end = await instantOf('11:00');

      await blockSlot({
        startsAt: start,
        endsAt: end,
        employeeId: nadiaId,
      }).expect(201);

      const response = await request(server)
        .get(api('/blocked-slots'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const slots = response.body as {
        employeeId: string | null;
        employeeName: string | null;
      }[];

      // Le gérant raisonne en noms, pas en identifiants : sans le nom, la
      // liste afficherait « Absence : cmu9… ».
      expect(slots[0].employeeId).toBe(nadiaId);
      expect(slots[0].employeeName).toBe('Nadia');
    });

    it('refuse un membre appartenant à un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213555900002',
      });
      const autreToken = await loginAs(server, autre.phone, autre.password);

      const etranger = await request(server)
        .post(api('/employees'))
        .set('Authorization', `Bearer ${autreToken}`)
        .send({ fullName: 'Membre du salon voisin' })
        .expect(201);

      const start = await instantOf('09:00');
      const end = await instantOf('11:00');

      await blockSlot({
        startsAt: start,
        endsAt: end,
        employeeId: (etranger.body as { id: string }).id,
      }).expect(404);

      // Le blocage ne doit surtout pas retomber sur « tout le salon » : ce
      // serait transformer une erreur en fermeture silencieuse.
      expect(await slotsFor()).toContain('09:00');
    });

    it('refuse d’absenter un membre qui a déjà un rendez-vous', async () => {
      const morning = await instantOf('09:00');

      await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: morning,
          prestationIds: [salon.prestationId],
          employeeId: nadiaId,
          clientFirstName: 'Amina',
          clientPhone: '+213661000003',
        })
        .expect(201);

      const end = await instantOf('11:00');
      const response = await blockSlot({
        startsAt: morning,
        endsAt: end,
        employeeId: nadiaId,
      }).expect(400);

      expect((response.body as { message: string }).message).toMatch(
        /rendez-vous confirmé/i,
      );
    });

    it('n’est pas gêné par le rendez-vous d’un collègue', async () => {
      const morning = await instantOf('09:00');

      await request(server)
        .post(api(`/salons/${salon.slug}/reservations`))
        .send({
          startsAt: morning,
          prestationIds: [salon.prestationId],
          employeeId: sofiaId,
          clientFirstName: 'Amina',
          clientPhone: '+213661000004',
        })
        .expect(201);

      // Le RDV de Sofia ne doit pas empêcher Nadia de poser son absence.
      const end = await instantOf('11:00');
      await blockSlot({
        startsAt: morning,
        endsAt: end,
        employeeId: nadiaId,
      }).expect(201);
    });
  });
});
