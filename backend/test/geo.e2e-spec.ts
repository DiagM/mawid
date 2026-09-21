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
 * Position des salons et recherche de proximité
 * ============================================
 * Deux mécanismes distincts, testés ensemble parce que le second ne sert à
 * rien sans le premier : le gérant déclare sa position en collant un lien
 * Google Maps, et la cliente trie les salons du plus proche au plus loin.
 *
 * La régression qui ferait le plus de dégâts n'est pas un mauvais tri : c'est
 * qu'un salon désactivé réapparaisse par ce nouveau chemin de recherche. D'où
 * le scénario dédié plus bas.
 */

/** Repères réels d'Alger, pour que les distances attendues soient vérifiables. */
const GRANDE_POSTE = { lat: 36.7754, lng: 3.0588 };
const BOUZAREAH_LINK =
  'https://www.google.com/maps/place/Salon/@36.79,3.02,17z/data=!8m2!3d36.7906!4d3.0234';
const BAB_EZZOUAR_LINK =
  'https://www.google.com/maps/place/Salon/@36.71,3.18,17z/data=!8m2!3d36.7167!4d3.1833';

/** Corps d'une reponse de recherche, type une fois pour toutes. */
interface SearchBody {
  total: number;
  limit: number;
  offset: number;
  items: { slug: string; distanceMeters: number | null }[];
}

function searchBody(response: request.Response): SearchBody {
  return response.body as SearchBody;
}

function errorMessage(response: request.Response): string {
  return String((response.body as { message?: unknown }).message);
}

describe('Position et proximité (e2e)', () => {
  let ctx: TestContext;
  let server: App;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.server;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  async function setPosition(
    salon: SalonFixture,
    mapsUrl: string,
  ): Promise<request.Response> {
    const token = await loginAs(server, salon.phone, salon.password);

    return request(server)
      .patch(api('/salons/me'))
      .set('Authorization', `Bearer ${token}`)
      .send({ mapsUrl });
  }

  describe('déclaration de la position', () => {
    it('extrait les coordonnées du lien collé par le gérant', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-bouzareah',
        phone: '+213555810001',
      });

      const response = await setPosition(salon, BOUZAREAH_LINK);
      expect(response.status).toBe(200);

      const saved = await ctx.prisma.salon.findUniqueOrThrow({
        where: { id: salon.salonId },
        select: { latitude: true, longitude: true },
      });

      expect(saved.latitude).toBeCloseTo(36.7906, 4);
      expect(saved.longitude).toBeCloseTo(3.0234, 4);
    });

    it('refuse un lien illisible au lieu de l’ignorer', async () => {
      // Ignorer en silence laisserait un gérant convaincu d'avoir enregistré
      // sa position, sans jamais comprendre pourquoi ses clientes n'ont pas
      // d'itinéraire.
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-lien-casse',
        phone: '+213555810002',
      });

      const response = await setPosition(salon, 'https://example.com/pas-maps');

      expect(response.status).toBe(400);
      expect(errorMessage(response)).toContain('Google Maps');
    });

    it('refuse un point situé hors d’Algérie', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-paris',
        phone: '+213555810003',
      });

      const response = await setPosition(
        salon,
        'https://www.google.com/maps/@48.8566,2.3522,15z',
      );

      expect(response.status).toBe(400);
    });

    it('permet de retirer sa position avec un champ vide', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-retrait',
        phone: '+213555810004',
      });

      await setPosition(salon, BOUZAREAH_LINK);
      const response = await setPosition(salon, '');
      expect(response.status).toBe(200);

      const saved = await ctx.prisma.salon.findUniqueOrThrow({
        where: { id: salon.salonId },
        select: { latitude: true, longitude: true },
      });

      expect(saved.latitude).toBeNull();
      expect(saved.longitude).toBeNull();
    });

    it('un gérant ne déplace jamais le salon d’un autre', async () => {
      // L'isolation multi-tenant exigée par CLAUDE.md §3.2 : la route ne prend
      // aucun identifiant de salon, elle part de l'utilisateur du jeton.
      const a = await createSalon(ctx.prisma, {
        slug: 'salon-a',
        phone: '+213555810005',
      });
      const b = await createSalon(ctx.prisma, {
        slug: 'salon-b',
        phone: '+213555810006',
      });

      await setPosition(a, BOUZAREAH_LINK);

      const salonB = await ctx.prisma.salon.findUniqueOrThrow({
        where: { id: b.salonId },
        select: { latitude: true, longitude: true },
      });

      expect(salonB.latitude).toBeNull();
      expect(salonB.longitude).toBeNull();
    });
  });

  describe('recherche autour de moi', () => {
    async function searchAround(): Promise<request.Response> {
      return request(server)
        .get(api('/salons'))
        .query({ lat: GRANDE_POSTE.lat, lng: GRANDE_POSTE.lng });
    }

    it('classe le salon le plus proche en premier', async () => {
      const loin = await createSalon(ctx.prisma, {
        slug: 'salon-bab-ezzouar',
        phone: '+213555820001',
        name: 'AAA Bab Ezzouar',
      });
      const proche = await createSalon(ctx.prisma, {
        slug: 'salon-bouzareah-proche',
        phone: '+213555820002',
        name: 'ZZZ Bouzareah',
      });

      await setPosition(loin, BAB_EZZOUAR_LINK);
      await setPosition(proche, BOUZAREAH_LINK);

      const response = await searchAround();

      expect(response.status).toBe(200);
      // Les noms sont choisis pour que l'ordre alphabétique donne l'inverse :
      // si le tri par distance ne s'appliquait pas, ce test passerait à tort.
      expect(searchBody(response).items[0].slug).toBe('salon-bouzareah-proche');
      expect(searchBody(response).items[1].slug).toBe('salon-bab-ezzouar');
    });

    it('renvoie une distance plausible', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-distance',
        phone: '+213555820003',
      });
      await setPosition(salon, BOUZAREAH_LINK);

      const response = await searchAround();
      const distance = searchBody(response).items[0].distanceMeters;

      // Grande Poste -> Bouzaréah : environ 3,6 km.
      expect(distance).toBeGreaterThan(3300);
      expect(distance).toBeLessThan(3900);
    });

    it('place les salons sans position à la fin, sans les exclure', async () => {
      // Les exclure ferait disparaître du catalogue tout gérant n'ayant pas
      // encore collé son lien : c'est la cliente qui en paierait le prix.
      const situe = await createSalon(ctx.prisma, {
        slug: 'salon-situe',
        phone: '+213555820004',
      });
      await createSalon(ctx.prisma, {
        slug: 'salon-sans-position',
        phone: '+213555820005',
      });

      await setPosition(situe, BAB_EZZOUAR_LINK);

      const response = await searchAround();

      expect(searchBody(response).total).toBe(2);
      expect(searchBody(response).items[0].slug).toBe('salon-situe');
      expect(searchBody(response).items[1].slug).toBe('salon-sans-position');
      expect(searchBody(response).items[1].distanceMeters).toBeNull();
    });

    it('ne laisse PAS réapparaître un salon désactivé', async () => {
      // La régression la plus coûteuse : un second chemin de recherche qui
      // oublierait le filtre `isActive`. Un salon fermé, ou créé en
      // auto-inscription et pas encore validé, ne doit apparaître nulle part.
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-desactive',
        phone: '+213555820006',
      });
      await setPosition(salon, BOUZAREAH_LINK);
      await ctx.prisma.salon.update({
        where: { id: salon.salonId },
        data: { isActive: false },
      });

      const response = await searchAround();

      expect(searchBody(response).total).toBe(0);
      expect(searchBody(response).items).toHaveLength(0);
    });

    it('respecte le filtre de ville', async () => {
      const alger = await createSalon(ctx.prisma, {
        slug: 'salon-alger',
        phone: '+213555820007',
        city: 'Alger',
      });
      const oran = await createSalon(ctx.prisma, {
        slug: 'salon-oran',
        phone: '+213555820008',
        city: 'Oran',
      });

      await setPosition(alger, BOUZAREAH_LINK);
      await setPosition(oran, BAB_EZZOUAR_LINK);

      const response = await request(server)
        .get(api('/salons'))
        .query({ lat: GRANDE_POSTE.lat, lng: GRANDE_POSTE.lng, city: 'Alger' });

      expect(searchBody(response).total).toBe(1);
      expect(searchBody(response).items[0].slug).toBe('salon-alger');
    });

    it('pagine sans perdre l’ordre par distance', async () => {
      const loin = await createSalon(ctx.prisma, {
        slug: 'salon-loin',
        phone: '+213555820009',
      });
      const proche = await createSalon(ctx.prisma, {
        slug: 'salon-proche',
        phone: '+213555820010',
      });

      await setPosition(loin, BAB_EZZOUAR_LINK);
      await setPosition(proche, BOUZAREAH_LINK);

      const page2 = await request(server).get(api('/salons')).query({
        lat: GRANDE_POSTE.lat,
        lng: GRANDE_POSTE.lng,
        limit: 1,
        offset: 1,
      });

      // Le tri porte sur l'ensemble filtré, pas sur la page : le salon
      // lointain doit se trouver en page 2, jamais en page 1.
      expect(searchBody(page2).total).toBe(2);
      expect(searchBody(page2).items).toHaveLength(1);
      expect(searchBody(page2).items[0].slug).toBe('salon-loin');
    });

    it('ignore la proximité si une seule coordonnée est fournie', async () => {
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-coord-partielle',
        phone: '+213555820011',
      });
      await setPosition(salon, BOUZAREAH_LINK);

      const response = await request(server)
        .get(api('/salons'))
        .query({ lat: GRANDE_POSTE.lat });

      // La recherche fonctionne encore, mais sans distance : trier par rapport
      // à un point dont il manque la moitié donnerait un ordre absurde.
      expect(response.status).toBe(200);
      expect(searchBody(response).items[0].distanceMeters).toBeNull();
    });

    it('refuse une latitude hors bornes', async () => {
      const response = await request(server)
        .get(api('/salons'))
        .query({ lat: 200, lng: 3 });

      expect(response.status).toBe(400);
    });

    it('renvoie distanceMeters à null quand la position n’est pas demandée', async () => {
      // Le frontend ne doit avoir qu'une seule forme de réponse à traiter.
      const salon = await createSalon(ctx.prisma, {
        slug: 'salon-sans-geo',
        phone: '+213555820012',
      });
      await setPosition(salon, BOUZAREAH_LINK);

      const response = await request(server).get(api('/salons'));

      expect(searchBody(response).items[0].distanceMeters).toBeNull();
    });
  });
});
