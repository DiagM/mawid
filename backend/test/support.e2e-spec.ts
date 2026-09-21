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
  createAdmin,
  createSalon,
  type AdminFixture,
  type SalonFixture,
} from './helpers/fixtures';

/**
 * ============================================
 * Demandes adressées à Mawid
 * ============================================
 * Deux portes : un gérant connecté depuis son back-office, et n'importe qui
 * depuis la page contact publique — un salon pas encore inscrit doit pouvoir
 * écrire, c'est un canal d'acquisition.
 *
 * **Le ticket est la source de vérité, pas l'e-mail.** L'envoi n'est qu'une
 * notification : ces tests vérifient donc que la demande est enregistrée
 * quoi qu'il advienne de l'e-mail, qui n'est jamais appelé ici.
 */
describe('Demandes de support (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;
  let admin: AdminFixture;
  let managerToken: string;
  let adminToken: string;

  const VALID = {
    kind: 'ISSUE' as const,
    subject: 'Les créneaux du samedi ne s’affichent pas',
    message: 'Depuis hier, aucun créneau n’apparaît le samedi matin.',
    contactName: 'Karim Benali',
    contactPhone: '0555123456',
  };

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
      slug: 'salon-support',
      phone: '+213561000001',
      name: 'Salon Support',
      plan: 'FREE',
    });
    admin = await createAdmin(ctx.prisma);

    managerToken = await loginAs(server, salon.phone, salon.password);
    adminToken = await loginAs(server, admin.phone, admin.password);
  });

  function publicTicket(body: Record<string, unknown> = {}) {
    return request(server)
      .post(api('/support/tickets'))
      .send({ ...VALID, ...body });
  }

  function managerTicket(body: Record<string, unknown> = {}) {
    return request(server)
      .post(api('/support/tickets/mine'))
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...VALID, ...body });
  }

  function asAdmin(method: 'get' | 'patch', path: string) {
    return request(server)
      [method](api(path))
      .set('Authorization', `Bearer ${adminToken}`);
  }

  describe('porte publique', () => {
    it('accepte une demande sans compte', async () => {
      const response = await publicTicket().expect(201);

      expect((response.body as { id: string }).id).toEqual(expect.any(String));
    });

    it('normalise le téléphone en E.164', async () => {
      await publicTicket({ contactPhone: '0555123456' }).expect(201);

      // Stocké au format international comme partout ailleurs : un ticket
      // dont le numéro ne se rapproche d'aucune fiche cliente serait plus
      // difficile à recouper.
      const list = await asAdmin('get', '/admin/tickets').expect(200);
      expect((list.body as { contactPhone: string }[])[0].contactPhone).toBe(
        '+213555123456',
      );
    });

    it('refuse un numéro saisi avec des séparateurs', async () => {
      // Le DTO est strict, comme celui de l'inscription : c'est l'interface
      // qui normalise avant d'envoyer. Accepter les deux ici ferait diverger
      // deux validations du même numéro.
      await publicTicket({ contactPhone: '0555 12 34 56' }).expect(400);
    });

    it('n’attache aucun salon', async () => {
      await publicTicket().expect(201);

      const list = await asAdmin('get', '/admin/tickets').expect(200);
      expect((list.body as { salon: unknown }[])[0].salon).toBeNull();
    });

    it('refuse un honeypot rempli', async () => {
      await publicTicket({ website: 'http://spam.example' }).expect(400);
    });

    it('refuse un message trop court', async () => {
      // Deux mots ne permettent pas de traiter une demande ; exiger un
      // minimum évite une file de tickets vides.
      await publicTicket({ message: 'bug' }).expect(400);
    });

    it('refuse un numéro non algérien', async () => {
      await publicTicket({ contactPhone: '+33612345678' }).expect(400);
    });

    it('refuse un salon imposé dans le corps', async () => {
      // `forbidNonWhitelisted` : écrire au nom d'un autre salon doit être
      // impossible, même depuis la porte publique.
      await publicTicket({ salonId: salon.salonId }).expect(400);
    });
  });

  describe('porte du back-office', () => {
    it('rattache la demande au salon du gérant connecté', async () => {
      await managerTicket().expect(201);

      const list = await asAdmin('get', '/admin/tickets').expect(200);
      const ticket = (
        list.body as { salon: { slug: string; plan: string } | null }[]
      )[0];

      expect(ticket.salon?.slug).toBe(salon.slug);
      // L'offre actuelle est jointe : c'est la première chose à regarder
      // devant une demande de changement.
      expect(ticket.salon?.plan).toBe('FREE');
    });

    it('exige un JWT valide', async () => {
      await request(server)
        .post(api('/support/tickets/mine'))
        .send(VALID)
        .expect(401);
    });

    it('enregistre l’offre visée d’une demande de changement', async () => {
      await managerTicket({
        kind: 'UPGRADE',
        subject: 'Passer à Pro+',
        requestedPlan: 'PRO_PLUS',
      }).expect(201);

      const list = await asAdmin('get', '/admin/tickets').expect(200);
      expect(
        (list.body as { requestedPlan: string | null }[])[0].requestedPlan,
      ).toBe('PRO_PLUS');
    });

    it('ignore une offre visée hors d’une demande de changement', async () => {
      await managerTicket({ kind: 'ISSUE', requestedPlan: 'PRO' }).expect(201);

      // La garder laisserait croire à une demande de changement qui n'a
      // jamais été faite.
      const list = await asAdmin('get', '/admin/tickets').expect(200);
      expect(
        (list.body as { requestedPlan: string | null }[])[0].requestedPlan,
      ).toBeNull();
    });

    it('refuse une offre inexistante', async () => {
      await managerTicket({
        kind: 'UPGRADE',
        requestedPlan: 'GRATUIT_A_VIE',
      }).expect(400);
    });
  });

  describe('file de traitement', () => {
    it('ne montre que les demandes ouvertes par défaut', async () => {
      await publicTicket().expect(201);

      const list = await asAdmin('get', '/admin/tickets').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await asAdmin('patch', `/admin/tickets/${id}`)
        .send({ status: 'CLOSED' })
        .expect(200);

      expect((await asAdmin('get', '/admin/tickets').expect(200)).body).toEqual(
        [],
      );

      const all = await asAdmin('get', '/admin/tickets')
        .query({ status: 'ALL' })
        .expect(200);
      expect(all.body as unknown[]).toHaveLength(1);
    });

    it('date la clôture, et l’efface à la réouverture', async () => {
      await publicTicket().expect(201);
      const list = await asAdmin('get', '/admin/tickets').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      const closed = await asAdmin('patch', `/admin/tickets/${id}`)
        .send({ status: 'CLOSED' })
        .expect(200);
      expect(
        (closed.body as { closedAt: string | null }).closedAt,
      ).not.toBeNull();

      // Une demande rouverte ne doit pas garder une date qui laisserait
      // croire qu'elle est réglée.
      const reopened = await asAdmin('patch', `/admin/tickets/${id}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(
        (reopened.body as { closedAt: string | null }).closedAt,
      ).toBeNull();
    });

    it('accepte une note interne', async () => {
      await publicTicket().expect(201);
      const list = await asAdmin('get', '/admin/tickets').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await asAdmin('patch', `/admin/tickets/${id}`)
        .send({ internalNote: 'Rappelé, problème de fuseau horaire.' })
        .expect(200);

      const after = await asAdmin('get', '/admin/tickets').expect(200);
      expect(
        (after.body as { internalNote: string | null }[])[0].internalNote,
      ).toBe('Rappelé, problème de fuseau horaire.');
    });

    it('refuse une demande inconnue', async () => {
      await asAdmin('patch', '/admin/tickets/fantome')
        .send({ status: 'CLOSED' })
        .expect(404);
    });
  });

  describe('la file est réservée au fondateur', () => {
    it('un gérant ne peut ni la lire ni la modifier', async () => {
      await publicTicket().expect(201);

      await request(server)
        .get(api('/admin/tickets'))
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);

      await request(server)
        .patch(api('/admin/tickets/nimporte'))
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CLOSED' })
        .expect(403);
    });

    it('sans JWT non plus', async () => {
      await request(server).get(api('/admin/tickets')).expect(401);
    });

    it('ne laisse jamais fuiter la note interne côté public', async () => {
      await managerTicket().expect(201);
      const list = await asAdmin('get', '/admin/tickets').expect(200);
      const id = (list.body as { id: string }[])[0].id;

      await asAdmin('patch', `/admin/tickets/${id}`)
        .send({ internalNote: 'Client pénible' })
        .expect(200);

      // Aucune route ne renvoie un ticket à son auteur : la seule lecture
      // possible passe par la console.
      await request(server)
        .get(api(`/support/tickets/${id}`))
        .expect(404);
    });
  });
});
