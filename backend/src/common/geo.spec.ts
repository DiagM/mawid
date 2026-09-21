import { formatDistance, haversineMeters } from './geo';

/** Repères réels d'Alger, pour confronter le calcul à des distances connues. */
const GRANDE_POSTE = { lat: 36.7754, lng: 3.0588 };
const BOUZAREAH = { lat: 36.7906, lng: 3.0234 };
const BAB_EZZOUAR = { lat: 36.7167, lng: 3.1833 };

describe('haversineMeters', () => {
  it('renvoie zéro pour deux points confondus', () => {
    // Le cas qui casse une implémentation naïve : l'arrondi flottant peut
    // pousser l'argument d'asin au-delà de 1 et produire NaN.
    const d = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
    );

    expect(d).toBe(0);
    expect(Number.isNaN(d)).toBe(false);
  });

  it('mesure Grande Poste — Bouzaréah (environ 3,6 km)', () => {
    const d = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      BOUZAREAH.lat,
      BOUZAREAH.lng,
    );

    expect(d).toBeGreaterThan(3300);
    expect(d).toBeLessThan(3900);
  });

  it('mesure Grande Poste — Bab Ezzouar (environ 12 km)', () => {
    const d = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      BAB_EZZOUAR.lat,
      BAB_EZZOUAR.lng,
    );

    expect(d).toBeGreaterThan(11000);
    expect(d).toBeLessThan(13000);
  });

  it('est symétrique', () => {
    const aller = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      BAB_EZZOUAR.lat,
      BAB_EZZOUAR.lng,
    );
    const retour = haversineMeters(
      BAB_EZZOUAR.lat,
      BAB_EZZOUAR.lng,
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
    );

    expect(aller).toBeCloseTo(retour, 6);
  });

  it('classe correctement le proche et le lointain', () => {
    // C'est la seule propriété dont dépend réellement le tri des résultats.
    const proche = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      BOUZAREAH.lat,
      BOUZAREAH.lng,
    );
    const loin = haversineMeters(
      GRANDE_POSTE.lat,
      GRANDE_POSTE.lng,
      BAB_EZZOUAR.lat,
      BAB_EZZOUAR.lng,
    );

    expect(proche).toBeLessThan(loin);
  });
});

describe('formatDistance', () => {
  it.each([
    [10, '50 m'],
    [237, '250 m'],
    [800, '800 m'],
    [999, '1000 m'],
    [1000, '1,0 km'],
    [3600, '3,6 km'],
    [12000, '12 km'],
  ])('affiche %d m comme « %s »', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });

  it('n’annonce jamais une précision inférieure à 50 m', () => {
    // Une épingle posée à la main vaut ±50 m au mieux : « à 7 m » serait un
    // mensonge poli.
    expect(formatDistance(3)).toBe('50 m');
  });
});
