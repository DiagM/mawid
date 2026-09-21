import { MapsLinkService } from './maps-link.service';

const ALGER = { latitude: 36.7906, longitude: 3.0234 };
const FULL_LINK =
  'https://www.google.com/maps/place/Salon/@36.79,3.02,17z/data=!8m2!3d36.7906!4d3.0234';

/** Réponse de redirection minimale, sans corps. */
function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe('MapsLinkService', () => {
  let service: MapsLinkService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new MapsLinkService();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
    // Les avertissements attendus n'ont pas à polluer la sortie des tests.
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('lien complet', () => {
    it('lit les coordonnées sans toucher au réseau', async () => {
      await expect(service.resolve(FULL_LINK)).resolves.toEqual(ALGER);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('ne tente rien sur du texte quelconque', async () => {
      await expect(
        service.resolve('mon salon à Bouzaréah'),
      ).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('lien court', () => {
    it('suit la redirection puis lit les coordonnées', async () => {
      fetchSpy.mockResolvedValueOnce(redirectTo(FULL_LINK));
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toEqual(ALGER);
    });

    it('interroge en HEAD, jamais en GET', async () => {
      // Le corps n'est jamais utile : le demander exposerait le serveur à un
      // téléchargement arbitrairement gros.
      fetchSpy.mockResolvedValueOnce(redirectTo(FULL_LINK));
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

      await service.resolve('https://maps.app.goo.gl/AbCdEf');

      const calls = fetchSpy.mock.calls as [URL, RequestInit][];
      for (const [, init] of calls) {
        expect(init).toMatchObject({ method: 'HEAD', redirect: 'manual' });
      }
    });
  });

  describe('barrière SSRF', () => {
    it('refuse une redirection vers un hôte interne, sans l’interroger', async () => {
      // Le scénario qu'on redoute : l'adresse des métadonnées d'instance chez
      // la plupart des hébergeurs, qui sert souvent des identifiants.
      fetchSpy.mockResolvedValueOnce(
        redirectTo('https://169.254.169.254/latest/meta-data/'),
      );

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();

      // Un seul appel : celui vers le lien court. L'hôte interne n'a jamais
      // été contacté.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [[target]] = fetchSpy.mock.calls as [URL][];
      expect(String(target)).toContain('maps.app.goo.gl');
    });

    it('refuse une redirection vers un domaine qui imite Google', async () => {
      fetchSpy.mockResolvedValueOnce(
        redirectTo('https://google.evil.com/maps/@36.79,3.02,17z'),
      );

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('refuse une redirection en clair', async () => {
      fetchSpy.mockResolvedValueOnce(
        redirectTo('http://www.google.com/maps/@36.79,3.02,17z'),
      );

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();
    });
  });

  describe('robustesse', () => {
    it('abandonne après trop de redirections', async () => {
      fetchSpy.mockResolvedValue(redirectTo('https://maps.app.goo.gl/encore'));

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('ne lève pas quand le réseau tombe', async () => {
      // Un service de cartographie injoignable ne doit pas empêcher un gérant
      // d'enregistrer le reste de sa fiche.
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();
    });

    it('ne lève pas quand la redirection mène à une page sans coordonnées', async () => {
      fetchSpy.mockResolvedValueOnce(
        redirectTo('https://www.google.com/maps/place/Salon+Elegance'),
      );
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));

      await expect(
        service.resolve('https://maps.app.goo.gl/AbCdEf'),
      ).resolves.toBeNull();
    });
  });
});
