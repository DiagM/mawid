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
 * Authentification des gérants
 * ============================================
 * Un compte gérant compromis donne accès à l'agenda complet du salon et aux
 * numéros de téléphone de toutes ses clientes. C'est la surface la plus
 * sensible du projet.
 */
describe('Authentification (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let salon: SalonFixture;

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
      slug: 'salon-auth',
      phone: '+213555500001',
    });
  });

  function login(body: Record<string, unknown>) {
    return request(server).post(api('/auth/login')).send(body);
  }

  describe('connexion', () => {
    it('renvoie un JWT exploitable', async () => {
      const response = await login({
        phone: salon.phone,
        password: salon.password,
      }).expect(200);

      const body = response.body as {
        accessToken: string;
        user: { phone: string; role: string; passwordHash?: string };
      };

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user.phone).toBe(salon.phone);
      expect(body.user.role).toBe('MANAGER');
      // Le hash ne doit jamais sortir de la base, même pour son propriétaire.
      expect(body.user).not.toHaveProperty('passwordHash');

      await request(server)
        .get(api('/auth/me'))
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
    });

    it('ne laisse pas deviner si le numéro existe', async () => {
      // CLAUDE.md §3.4 : message identique dans les deux cas. Distinguer
      // « numéro inconnu » de « mot de passe incorrect » transformerait cette
      // route en annuaire des gérants inscrits.
      const unknownPhone = await login({
        phone: '+213555999999',
        password: salon.password,
      }).expect(401);

      const wrongPassword = await login({
        phone: salon.phone,
        password: 'mauvaismotdepasse',
      }).expect(401);

      expect((unknownPhone.body as { message: string }).message).toBe(
        (wrongPassword.body as { message: string }).message,
      );
    });

    it('refuse un numéro mal formé sans même consulter la base', async () => {
      await login({ phone: '0555100001', password: salon.password }).expect(
        400,
      );
    });
  });

  describe('inscription self-service', () => {
    const validRegistration = {
      phone: '0555700001',
      fullName: 'Amel Gérante',
      password: 'motdepasse2026',
      salonName: 'Salon Élégance',
      addressLine: '12 rue Didouche Mourad',
      district: 'Alger Centre',
      contactPhone: '0661700001',
    };

    function register(overrides: Record<string, unknown> = {}) {
      return request(server)
        .post(api('/auth/register'))
        .send({ ...validRegistration, ...overrides });
    }

    it('crée un salon INACTIF, invisible du public', async () => {
      const response = await register().expect(201);
      const token = (response.body as { accessToken: string }).accessToken;

      // C'est la contrepartie qui rend cette route ouvrable sans vérification
      // d'identité : un faux salon n'atteint aucun client.
      const mine = await request(server)
        .get(api('/salons/me'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = mine.body as { isActive: boolean; slug: string };
      expect(body.isActive).toBe(false);

      await request(server)
        .get(api(`/salons/${body.slug}`))
        .expect(404);

      const search = await request(server).get(api('/salons')).expect(200);
      const slugs = (search.body as { items: { slug: string }[] }).items.map(
        (item) => item.slug,
      );
      expect(slugs).not.toContain(body.slug);
    });

    it('normalise le téléphone en E.164', async () => {
      const response = await register().expect(201);
      const user = (response.body as { user: { phone: string } }).user;

      // Stocker « 0555700001 » et « +213555700001 » comme deux comptes
      // distincts ferait échouer la connexion une fois sur deux.
      expect(user.phone).toBe('+213555700001');
    });

    it('ne révèle pas qu’un numéro est déjà inscrit', async () => {
      await register().expect(201);

      const response = await register().expect(409);
      const message = (response.body as { message: string }).message;

      expect(message).not.toMatch(/déjà un compte sur ce numéro/i);
      expect(message).toMatch(/inscription impossible/i);
    });

    it.each([
      ['isActive', { isActive: true }],
      ['plan', { plan: 'PRO_PLUS' }],
      ['role', { role: 'ADMIN' }],
      ['slug', { slug: 'salon-premium' }],
    ])('refuse un champ privilégié imposé : %s', async (_label, overrides) => {
      // Sans `forbidNonWhitelisted`, n'importe qui s'auto-validerait, se
      // donnerait un plan payant ou deviendrait administrateur.
      await register(overrides).expect(400);
    });

    it('refuse un mot de passe trop faible', async () => {
      await register({ password: 'motdepasse' }).expect(400);
      await register({ password: 'azer1' }).expect(400);
    });

    it('refuse un honeypot rempli', async () => {
      await register({ website: 'http://spam.example' }).expect(400);
    });
  });

  describe('changement de mot de passe', () => {
    let token: string;

    beforeEach(async () => {
      token = await loginAs(server, salon.phone, salon.password);
    });

    function changePassword(body: Record<string, unknown>) {
      return request(server)
        .patch(api('/auth/password'))
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    }

    it('exige l’ancien mot de passe malgré le JWT', async () => {
      // Un JWT volé — session laissée ouverte sur le poste du salon — ne doit
      // pas suffire à verrouiller le compte de son propriétaire légitime.
      await changePassword({
        currentPassword: 'pasLeBon2026',
        newPassword: 'nouveaupass2026',
      }).expect(401);
    });

    it('remplace le mot de passe et invalide l’ancien', async () => {
      await changePassword({
        currentPassword: salon.password,
        newPassword: 'nouveaupass2026',
      }).expect(200);

      await request(server)
        .post(api('/auth/login'))
        .send({ phone: salon.phone, password: salon.password })
        .expect(401);

      await request(server)
        .post(api('/auth/login'))
        .send({ phone: salon.phone, password: 'nouveaupass2026' })
        .expect(200);
    });

    it('refuse un nouveau mot de passe sans chiffre', async () => {
      await changePassword({
        currentPassword: salon.password,
        newPassword: 'seulementdeslettres',
      }).expect(400);
    });
  });
});
