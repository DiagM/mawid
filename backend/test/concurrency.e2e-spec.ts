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
 * Double réservation d'un même créneau
 * ============================================
 * Le moteur de disponibilité vérifie qu'un créneau est libre AVANT d'insérer.
 * Cette vérification ne prouve rien : entre la lecture et l'écriture, une
 * autre requête peut avoir réservé le même créneau. Deux clientes se
 * retrouveraient alors chez le coiffeur à la même heure — exactement ce que
 * le produit promet d'éviter.
 *
 * La seule protection réelle est la contrainte d'exclusion PostgreSQL
 * (`reservations_no_overlap`, migration `employee_scoped_overlap`) :
 *
 *   EXCLUDE USING gist (
 *     (COALESCE("employeeId", "salonId")) WITH =,
 *     tsrange("startsAt", "endsAt", '[)') WITH &&
 *   ) WHERE ("status" = 'CONFIRMED')
 *
 * Elle vit en base et nulle part ailleurs : aucun test unitaire ne peut la
 * couvrir, et une migration mal appliquée la ferait disparaître sans bruit.
 * D'où ce fichier.
 */
describe('Contrainte anti-double-réservation (e2e)', () => {
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
      slug: 'salon-concurrent',
      phone: '+213555200001',
    });
    date = futureLocalDate();
  });

  async function firstSlot(): Promise<string> {
    const response = await request(server)
      .get(api(`/salons/${salon.slug}/availability`))
      .query({ date, prestationIds: salon.prestationId })
      .expect(200);

    return (response.body as { slots: { startsAt: string }[] }).slots[0]
      .startsAt;
  }

  /**
   * Un numéro distinct par tentative.
   *
   * Sinon le plafond par téléphone (`maxUpcomingPerPhonePerSalon`) refuserait
   * les requêtes avant même qu'elles n'atteignent la base, et le test
   * vérifierait l'anti-abus au lieu de la contrainte d'exclusion.
   */
  function phoneFor(index: number): string {
    return `+21366${String(100000 + index).padStart(7, '0')}`;
  }

  function book(startsAt: string, index: number, employeeId?: string) {
    return request(server)
      .post(api(`/salons/${salon.slug}/reservations`))
      .send({
        startsAt,
        prestationIds: [salon.prestationId],
        clientFirstName: `Cliente${index}`,
        clientPhone: phoneFor(index),
        ...(employeeId && { employeeId }),
      });
  }

  it('un seul gagnant sur huit tentatives simultanées', async () => {
    const slot = await firstSlot();

    // Toutes les requêtes partent avant qu'aucune n'ait répondu : les huit
    // lisent donc « créneau libre ». C'est précisément le scénario que le
    // contrôle applicatif ne peut pas attraper seul.
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) => book(slot, index)),
    );

    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);

    // La répartition des refus entre 400 (le contrôle applicatif a vu la
    // réservation gagnante) et 409 (c'est la base qui a tranché) dépend de
    // l'ordonnancement et varie d'une exécution à l'autre. L'exiger rendrait
    // le test instable ; ce qui doit être vrai à chaque fois, c'est qu'aucune
    // requête ne passe en trop et qu'aucune ne finit en erreur serveur.
    expect(statuses.every((status) => [201, 400, 409].includes(status))).toBe(
      true,
    );

    const count = await ctx.prisma.reservation.count({
      where: { salonId: salon.salonId, status: 'CONFIRMED' },
    });
    expect(count).toBe(1);
  });

  it('la base refuse elle-même un chevauchement, sans passer par l’API', async () => {
    const slot = await firstSlot();
    await book(slot, 0).expect(201);

    // Insertion directe, en court-circuitant tout le code applicatif : c'est
    // le seul moyen de prouver que la contrainte existe RÉELLEMENT dans cette
    // base. Sans elle, ce test insérerait tranquillement un doublon — et
    // c'est exactement ce qui arriverait si la migration
    // `employee_scoped_overlap` n'était pas appliquée en production.
    const existing = await ctx.prisma.reservation.findFirstOrThrow({
      where: { salonId: salon.salonId },
      select: { salonId: true, clientId: true, startsAt: true, endsAt: true },
    });

    const duplicate = ctx.prisma.reservation.create({
      data: {
        ...existing,
        clientFirstName: 'Doublon',
        clientPhone: '+213660000999',
      },
    });

    // On vérifie le motif exact plutôt qu'un `rejects.toThrow()` nu : celui-ci
    // passerait au vert sur n'importe quelle erreur — une colonne manquante,
    // par exemple — et laisserait croire que la contrainte a joué alors
    // qu'elle a disparu.
    await expect(duplicate).rejects.toThrow(/reservations_no_overlap/);

    const count = await ctx.prisma.reservation.count({
      where: { salonId: salon.salonId, status: 'CONFIRMED' },
    });
    expect(count).toBe(1);
  });

  it('un créneau chevauchant partiellement est refusé', async () => {
    const slot = await firstSlot();
    await book(slot, 0).expect(201);

    // 09:15 alors que 09:00–09:30 est pris : les deux se chevauchent, même
    // si les heures de début diffèrent.
    const overlapping = new Date(
      new Date(slot).getTime() + 15 * 60 * 1000,
    ).toISOString();

    const response = await book(overlapping, 1);
    expect([400, 409]).toContain(response.status);

    const count = await ctx.prisma.reservation.count({
      where: { salonId: salon.salonId, status: 'CONFIRMED' },
    });
    expect(count).toBe(1);
  });

  it('deux créneaux adjacents cohabitent', async () => {
    const slot = await firstSlot();
    await book(slot, 0).expect(201);

    // 09:30 quand 09:00–09:30 est pris : bornes semi-ouvertes `[start, end)`,
    // donc aucun chevauchement. Si ce test échouait, le salon perdrait un
    // créneau sur deux.
    const adjacent = new Date(
      new Date(slot).getTime() + 30 * 60 * 1000,
    ).toISOString();

    await book(adjacent, 1).expect(201);
  });

  it('un créneau annulé redevient réservable', async () => {
    const slot = await firstSlot();
    const first = await book(slot, 0).expect(201);
    const token = (first.body as { cancellationToken: string })
      .cancellationToken;

    await request(server)
      .delete(api(`/reservations/token/${token}`))
      .expect(200);

    // La contrainte est partielle (`WHERE status = 'CONFIRMED'`) : la ligne
    // annulée reste en base sans bloquer le créneau.
    await book(slot, 1).expect(201);
  });

  describe('avec une équipe', () => {
    let token: string;
    let employees: string[];

    beforeEach(async () => {
      token = await loginAs(server, salon.phone, salon.password);

      employees = [];
      for (const fullName of ['Nadia', 'Sofia']) {
        const response = await request(server)
          .post(api('/employees'))
          .set('Authorization', `Bearer ${token}`)
          .send({ fullName })
          .expect(201);
        employees.push((response.body as { id: string }).id);
      }
    });

    it('deux membres travaillent au même instant', async () => {
      const slot = await firstSlot();

      await book(slot, 0, employees[0]).expect(201);
      // La clé de la contrainte est `COALESCE("employeeId", "salonId")` : deux
      // employés différents ne partagent pas la même clé, donc pas de conflit.
      await book(slot, 1, employees[1]).expect(201);
    });

    it('le même membre ne peut pas être pris deux fois', async () => {
      const slot = await firstSlot();

      await book(slot, 0, employees[0]).expect(201);
      const response = await book(slot, 1, employees[0]);

      expect([400, 409]).toContain(response.status);
    });

    it('un membre saturé laisse la place à son collègue', async () => {
      const slot = await firstSlot();

      await book(slot, 0, employees[0]).expect(201);

      // Sans préférence exprimée, le moteur doit basculer sur Sofia plutôt
      // que de déclarer le créneau indisponible.
      const response = await book(slot, 1).expect(201);
      expect((response.body as { localTime: string }).localTime).toBe('09:00');

      const reservations = await ctx.prisma.reservation.findMany({
        where: { salonId: salon.salonId, status: 'CONFIRMED' },
        select: { employeeId: true },
      });

      expect(new Set(reservations.map((r) => r.employeeId)).size).toBe(2);
    });

    it('le troisième client ne trouve plus de place', async () => {
      const slot = await firstSlot();

      await book(slot, 0, employees[0]).expect(201);
      await book(slot, 1, employees[1]).expect(201);

      const response = await book(slot, 2);
      expect([400, 409]).toContain(response.status);
    });
  });

  describe('créneaux bloqués par le gérant', () => {
    it('un créneau bloqué disparaît des disponibilités et refuse la réservation', async () => {
      const slot = await firstSlot();
      const token = await loginAs(server, salon.phone, salon.password);
      const endsAt = new Date(
        new Date(slot).getTime() + 30 * 60 * 1000,
      ).toISOString();

      await request(server)
        .post(api('/blocked-slots'))
        .set('Authorization', `Bearer ${token}`)
        .send({ startsAt: slot, endsAt, reason: 'Livraison' })
        .expect(201);

      const availability = await request(server)
        .get(api(`/salons/${salon.slug}/availability`))
        .query({ date, prestationIds: salon.prestationId })
        .expect(200);

      const slots = (availability.body as { slots: { startsAt: string }[] })
        .slots;
      expect(slots.map((s) => s.startsAt)).not.toContain(slot);

      // Et pas seulement masqué à l'affichage : un client qui posterait le
      // créneau à la main doit aussi être refusé.
      const response = await book(slot, 0);
      expect([400, 409]).toContain(response.status);
    });
  });
});
