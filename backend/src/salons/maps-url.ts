/**
 * ============================================
 * Extraction de coordonnées depuis un lien Google Maps
 * ============================================
 * Demander à un gérant de saisir une latitude et une longitude serait irréel :
 * personne ne les connaît. En revanche, presque tous les salons algérois ont
 * déjà une fiche Google qu'ils partagent sur Instagram ou WhatsApp. On leur
 * demande donc ce qu'ils ont sous la main — leur lien — et on en tire le point.
 *
 * Ce module est volontairement PUR : aucune requête réseau. Les liens courts
 * (`maps.app.goo.gl`) doivent être résolus en amont, dans le service, où le
 * risque réseau se contrôle (voir `resolveMapsShortLink`).
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Bornes approximatives de l'Algérie.
 *
 * La V1 ne dessert qu'Alger. Un point tombant hors du pays vient forcément
 * d'un lien collé par erreur — celui d'un autre commerce, ou une carte laissée
 * ouverte sur une autre ville. Mieux vaut refuser que d'enregistrer une
 * épingle qui enverra des clientes à 1 000 km : une épingle fausse est pire
 * qu'une épingle absente.
 */
const ALGERIA_BOUNDS = {
  minLatitude: 18.9,
  maxLatitude: 37.2,
  minLongitude: -8.7,
  maxLongitude: 12.1,
};

/** Le point de la FICHE : `!3d<lat>!4d<lng>` dans le segment `data=`. */
const PLACE_PATTERN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

/**
 * Le centre de la CARTE : `@<lat>,<lng>,<zoom>z`.
 *
 * Moins précis que `!3d!4d` — c'est le cadrage, pas l'établissement — d'où
 * l'ordre de priorité plus bas.
 */
const VIEWPORT_PATTERN = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/** Une paire « lat,lng » nue, telle qu'on la trouve dans `?q=` ou collée seule. */
const BARE_PAIR_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Paramètres d'URL susceptibles de porter une paire de coordonnées. */
const COORDINATE_PARAMS = ['query', 'q', 'll', 'daddr', 'destination'];

/**
 * Hôtes acceptés pour un lien Maps.
 *
 * Sert de garde-fou avant toute résolution réseau d'un lien court : sans
 * liste blanche, un gérant pourrait faire interroger par le serveur n'importe
 * quelle adresse, y compris un service interne (SSRF).
 */
export function isGoogleMapsHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return (
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    // google.com, google.dz, www.google.fr, maps.google.co.uk…
    /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2,3})?$/.test(host)
  );
}

/** Un lien court n'expose rien : il faut suivre sa redirection pour le lire. */
export function isMapsShortLink(input: string): boolean {
  const url = safeParseUrl(input);
  if (!url) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return host === 'maps.app.goo.gl' || host === 'goo.gl';
}

/**
 * Extrait un point d'un lien Google Maps, ou d'une paire « lat,lng » collée
 * telle quelle — certains gérants recopient les coordonnées à la main.
 *
 * Renvoie `null` si rien d'exploitable n'est trouvé, plutôt que de lever :
 * l'appelant décide du message, qui diffère selon qu'on parle à un gérant ou
 * à un test.
 */
export function parseMapsCoordinates(input: string): Coordinates | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  // Cas le plus simple d'abord : la personne a collé « 36.75, 3.06 ».
  const bare = BARE_PAIR_PATTERN.exec(raw);
  if (bare) {
    return validate(Number(bare[1]), Number(bare[2]));
  }

  const url = safeParseUrl(raw);
  if (!url || !isGoogleMapsHost(url.hostname)) {
    return null;
  }

  // Ordre délibéré : le point de la fiche prime sur le cadrage de la carte,
  // qui prime sur un paramètre d'URL. Un lien de fiche contient souvent les
  // trois, et seul `!3d!4d` désigne l'établissement lui-même.
  const place = PLACE_PATTERN.exec(raw);
  if (place) {
    const point = validate(Number(place[1]), Number(place[2]));
    if (point) {
      return point;
    }
  }

  const viewport = VIEWPORT_PATTERN.exec(url.pathname);
  if (viewport) {
    const point = validate(Number(viewport[1]), Number(viewport[2]));
    if (point) {
      return point;
    }
  }

  for (const name of COORDINATE_PARAMS) {
    const value = url.searchParams.get(name);
    if (!value) {
      continue;
    }

    const pair = BARE_PAIR_PATTERN.exec(value);
    if (pair) {
      const point = validate(Number(pair[1]), Number(pair[2]));
      if (point) {
        return point;
      }
    }
  }

  return null;
}

function safeParseUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    // Seul HTTPS : un lien en clair serait modifiable en transit, et Google
    // ne sert plus rien d'autre.
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function validate(latitude: number, longitude: number): Coordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (
    latitude < ALGERIA_BOUNDS.minLatitude ||
    latitude > ALGERIA_BOUNDS.maxLatitude ||
    longitude < ALGERIA_BOUNDS.minLongitude ||
    longitude > ALGERIA_BOUNDS.maxLongitude
  ) {
    return null;
  }

  return { latitude, longitude };
}
