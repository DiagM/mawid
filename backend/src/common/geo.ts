/**
 * ============================================
 * Distance entre deux points du globe
 * ============================================
 * Formule de Haversine, en mètres. Pas de PostGIS ni de service tiers : une
 * dizaine de lignes suffisent, et à l'échelle d'une ville l'écart avec un
 * calcul géodésique complet se compte en mètres — sans commune mesure avec
 * l'imprécision d'une épingle posée à la main sur une carte.
 */

/** Rayon moyen de la Terre. */
const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const phi1 = toRadians(fromLatitude);
  const phi2 = toRadians(toLatitude);
  const deltaPhi = toRadians(toLatitude - fromLatitude);
  const deltaLambda = toRadians(toLongitude - fromLongitude);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  // `Math.min(1, ...)` borne le domaine d'`asin` : sur deux points
  // confondus, l'arrondi flottant peut produire un `a` très légèrement
  // supérieur à 1, et `asin` renverrait alors NaN.
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Distance lisible par un humain.
 *
 * En dessous du kilomètre on arrondit à 50 m près : afficher « à 237 m »
 * suggère une précision que l'épingle d'un gérant n'a pas.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  }

  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
