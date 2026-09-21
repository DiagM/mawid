import {
  isGoogleMapsHost,
  isMapsShortLink,
  parseMapsCoordinates,
} from './maps-url';

/** Coordonnées réelles d'un point à Bouzaréah, Alger. */
const ALGER = { latitude: 36.7906, longitude: 3.0234 };

describe('parseMapsCoordinates', () => {
  describe('formats acceptés', () => {
    it('lit le point de la fiche (!3d!4d)', () => {
      const url =
        'https://www.google.com/maps/place/Salon/@36.7900,3.0200,17z/' +
        'data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d36.7906!4d3.0234';

      expect(parseMapsCoordinates(url)).toEqual(ALGER);
    });

    it('préfère le point de la fiche au cadrage de la carte', () => {
      // Le `@` est le centre de l'écran au moment de la copie : il peut être
      // à plusieurs centaines de mètres de l'établissement. Se tromper ici
      // enverrait les clientes dans la mauvaise rue.
      const url =
        'https://www.google.com/maps/place/Salon/@36.7000,3.0000,17z/' +
        'data=!4m6!3m5!8m2!3d36.7906!4d3.0234';

      expect(parseMapsCoordinates(url)).toEqual(ALGER);
    });

    it('retombe sur le cadrage quand la fiche est absente', () => {
      const url = 'https://www.google.com/maps/@36.7906,3.0234,15z';

      expect(parseMapsCoordinates(url)).toEqual(ALGER);
    });

    it('lit le paramètre query des liens de partage', () => {
      const url =
        'https://www.google.com/maps/search/?api=1&query=36.7906,3.0234';

      expect(parseMapsCoordinates(url)).toEqual(ALGER);
    });

    it('lit le paramètre q historique', () => {
      expect(
        parseMapsCoordinates('https://maps.google.com/?q=36.7906,3.0234'),
      ).toEqual(ALGER);
    });

    it('accepte un domaine national', () => {
      expect(
        parseMapsCoordinates('https://www.google.dz/maps/@36.7906,3.0234,15z'),
      ).toEqual(ALGER);
    });

    it('accepte une paire collée à la main', () => {
      // Certains gérants recopient les chiffres plutôt que le lien.
      expect(parseMapsCoordinates('36.7906, 3.0234')).toEqual(ALGER);
    });
  });

  describe('refus', () => {
    it('refuse un hôte qui n’est pas Google', () => {
      expect(
        parseMapsCoordinates('https://notgoogle.com/maps/@36.79,3.02,15z'),
      ).toBeNull();
    });

    it('refuse un hôte qui imite Google', () => {
      // `google.evil.com` ne doit pas passer pour un domaine Google.
      expect(
        parseMapsCoordinates('https://google.evil.com/maps/@36.79,3.02,15z'),
      ).toBeNull();
    });

    it('refuse un lien en clair', () => {
      expect(
        parseMapsCoordinates('http://www.google.com/maps/@36.79,3.02,15z'),
      ).toBeNull();
    });

    it('refuse un point hors d’Algérie', () => {
      // Paris. Le cas réel : un gérant colle un lien trouvé ailleurs, ou une
      // carte restée ouverte sur une autre ville.
      expect(
        parseMapsCoordinates('https://www.google.com/maps/@48.8566,2.3522,15z'),
      ).toBeNull();
    });

    it('refuse un lien Google sans coordonnées', () => {
      expect(
        parseMapsCoordinates(
          'https://www.google.com/maps/place/Salon+Elegance',
        ),
      ).toBeNull();
    });

    it('refuse du texte quelconque', () => {
      expect(parseMapsCoordinates('mon salon est à Bouzaréah')).toBeNull();
    });

    it('refuse une chaîne vide', () => {
      expect(parseMapsCoordinates('   ')).toBeNull();
    });
  });
});

describe('isGoogleMapsHost', () => {
  it.each([
    'google.com',
    'www.google.com',
    'maps.google.com',
    'google.dz',
    'www.google.co.uk',
    'maps.app.goo.gl',
    'goo.gl',
  ])('accepte %s', (host) => {
    expect(isGoogleMapsHost(host)).toBe(true);
  });

  it.each([
    'notgoogle.com',
    'google.evil.com',
    'goo.gl.evil.com',
    'localhost',
    '169.254.169.254',
  ])('refuse %s', (host) => {
    // Cette liste blanche est la barrière anti-SSRF : le serveur suit la
    // redirection des liens courts, donc tout hôte accepté ici est un hôte
    // que le serveur acceptera d'interroger.
    expect(isGoogleMapsHost(host)).toBe(false);
  });
});

describe('isMapsShortLink', () => {
  it('reconnaît un lien court moderne', () => {
    expect(isMapsShortLink('https://maps.app.goo.gl/AbCdEf123')).toBe(true);
  });

  it('reconnaît un lien court historique', () => {
    expect(isMapsShortLink('https://goo.gl/maps/AbCdEf123')).toBe(true);
  });

  it('ne confond pas un lien complet avec un lien court', () => {
    expect(isMapsShortLink('https://www.google.com/maps/@36.79,3.02,15z')).toBe(
      false,
    );
  });
});
