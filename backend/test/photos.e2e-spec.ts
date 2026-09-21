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
 * Photos de salon
 * ============================================
 * `Salon.photos` existait et la recherche affichait déjà `photos[0]` — mais
 * rien ne permettait d'en déposer. Toutes les fiches étaient donc sans
 * image, dans un secteur qui se vend à l'œil.
 *
 * Le fichier part du navigateur **directement vers Cloudinary** ; le backend
 * ne fait que signer. Ce qui revient du navigateur n'est donc pas digne de
 * confiance, et c'est ce que ce fichier vérifie surtout : aucune URL fournie
 * par le client ne doit atterrir sur une fiche.
 *
 * Les scénarios qui appelleraient réellement Cloudinary ne sont pas testés
 * ici — une suite qui dépendrait d'un service tiers échouerait le jour où
 * le réseau tousse, pour une raison sans rapport avec le code. C'est le cas
 * du dédoublonnage à l'enregistrement, vérifié à la main : il suppose une
 * image réellement déposée.
 */
describe('Photos de salon (e2e)', () => {
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
      slug: 'salon-photos',
      phone: '+213560000001',
    });
    token = await loginAs(server, salon.phone, salon.password);
  });

  /** Les routes vivent sous `/salons/me/photos` : le salon vient du JWT. */
  function as(method: 'post' | 'patch' | 'delete', path = '') {
    return request(server)
      [method](api(`/salons/me/photos${path}`))
      .set('Authorization', `Bearer ${token}`);
  }

  /** Pose des photos directement en base, sans passer par l'hébergeur. */
  async function seedPhotos(urls: string[]) {
    await ctx.prisma.salon.update({
      where: { id: salon.salonId },
      data: { photos: urls },
    });
  }

  const PHOTO = (n: number) =>
    `https://res.cloudinary.com/demo/image/upload/v1/mawid/salons/x/photo-${n}.jpg`;

  describe('autorisation d’envoi', () => {
    it('signe une demande limitée au dossier du salon', async () => {
      const response = await as('post', '/signature').expect(201);
      const body = response.body as {
        folder: string;
        signature: string;
        apiKey: string;
        timestamp: number;
      };

      // Le dossier est SIGNÉ : un gérant ne peut pas déposer ailleurs, même
      // en modifiant la requête envoyée depuis son navigateur.
      expect(body.folder).toBe(`mawid/salons/${salon.salonId}`);
      expect(body.signature).toEqual(expect.any(String));
      expect(body.timestamp).toEqual(expect.any(Number));
    });

    it('ne renvoie jamais l’API secret', async () => {
      const response = await as('post', '/signature').expect(201);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toMatch(/secret/i);
      expect(raw).not.toContain(process.env.CLOUDINARY_API_SECRET ?? 'ø');
    });

    it('refuse au-delà du plafond de photos', async () => {
      await seedPhotos([1, 2, 3, 4, 5, 6].map(PHOTO));

      await as('post', '/signature').expect(400);
    });

    it('exige une authentification', async () => {
      await request(server)
        .post(api('/salons/me/photos/signature'))
        .expect(401);
    });
  });

  describe('enregistrement', () => {
    it('refuse un identifiant hors du dossier du salon', async () => {
      // Le cœur du dispositif : sans ce contrôle, un gérant pourrait
      // s'approprier l'image d'un autre salon.
      await as('post')
        .send({ publicId: 'mawid/salons/un-autre-salon/photo' })
        .expect(400);
    });

    it('refuse un identifiant qui ressemble au bon dossier', async () => {
      // `startsWith` sans le séparateur laisserait passer
      // « mawid/salons/<id>-bis/photo ».
      await as('post')
        .send({ publicId: `mawid/salons/${salon.salonId}-bis/photo` })
        .expect(400);
    });

    it('n’accepte pas une URL à la place d’un identifiant', async () => {
      await as('post')
        .send({ publicId: 'https://example.com/photo.jpg' })
        .expect(400);
    });

    it('refuse un champ inconnu', async () => {
      // `forbidNonWhitelisted` : pas question de glisser une `secureUrl`
      // toute faite dans le corps de la requête.
      await as('post')
        .send({
          publicId: `mawid/salons/${salon.salonId}/photo`,
          secureUrl: 'https://evil.example/photo.jpg',
        })
        .expect(400);
    });
  });

  describe('suppression', () => {
    it('retire la photo de la fiche', async () => {
      await seedPhotos([PHOTO(1), PHOTO(2)]);

      const response = await as('delete')
        .send({ url: PHOTO(1) })
        .expect(200);

      expect((response.body as { photos: string[] }).photos).toEqual([
        PHOTO(2),
      ]);
    });

    it('refuse une photo qui n’est pas la sienne', async () => {
      await seedPhotos([PHOTO(1)]);

      await as('delete')
        .send({ url: PHOTO(9) })
        .expect(404);
    });
  });

  describe('ordre', () => {
    it('met une autre photo en vitrine', async () => {
      await seedPhotos([PHOTO(1), PHOTO(2), PHOTO(3)]);

      const response = await as('patch')
        .send({ photos: [PHOTO(3), PHOTO(1), PHOTO(2)] })
        .expect(200);

      // `photos[0]` est ce qu'affichent les résultats de recherche.
      expect((response.body as { photos: string[] }).photos[0]).toBe(PHOTO(3));
    });

    it('refuse d’injecter une URL étrangère par le réordonnancement', async () => {
      await seedPhotos([PHOTO(1), PHOTO(2)]);

      await as('patch')
        .send({ photos: [PHOTO(1), 'https://evil.example/photo.jpg'] })
        .expect(400);
    });

    it('refuse une liste incomplète', async () => {
      await seedPhotos([PHOTO(1), PHOTO(2)]);

      await as('patch')
        .send({ photos: [PHOTO(1)] })
        .expect(400);
    });
  });

  describe('affichage public', () => {
    it('expose les photos sur la fiche et en recherche', async () => {
      await seedPhotos([PHOTO(1), PHOTO(2)]);

      const page = await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(200);
      expect((page.body as { photos: string[] }).photos).toHaveLength(2);

      const search = await request(server).get(api('/salons')).expect(200);
      const item = (
        search.body as { items: { slug: string; photo: string | null }[] }
      ).items.find((entry) => entry.slug === salon.slug)!;

      expect(item.photo).toBe(PHOTO(1));
    });

    it('un salon sans photo reste parfaitement consultable', async () => {
      // La dépendance externe ne doit jamais bloquer le cœur du produit.
      const page = await request(server)
        .get(api(`/salons/${salon.slug}`))
        .expect(200);

      expect((page.body as { photos: string[] }).photos).toEqual([]);
    });
  });

  describe('isolation', () => {
    it('un gérant ne touche jamais aux photos d’un autre salon', async () => {
      const autre = await createSalon(ctx.prisma, {
        slug: 'autre-salon',
        phone: '+213560000002',
      });
      await ctx.prisma.salon.update({
        where: { id: autre.salonId },
        data: { photos: [PHOTO(7)] },
      });

      // Aucune route n'accepte d'identifiant de salon : la suppression ne
      // peut porter que sur ses propres photos.
      await as('delete')
        .send({ url: PHOTO(7) })
        .expect(404);

      const untouched = await ctx.prisma.salon.findUniqueOrThrow({
        where: { id: autre.salonId },
        select: { photos: true },
      });
      expect(untouched.photos).toEqual([PHOTO(7)]);
    });
  });
});
