import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * ============================================
 * Limitation de débit
 * ============================================
 * Un seul throttler global, surchargé route par route avec `@Throttle`.
 *
 * Attention au piège de `@nestjs/throttler` : plusieurs throttlers nommés
 * déclarés globalement s'appliquent TOUS à chaque route. Déclarer un profil
 * "booking" à 10 requêtes/heure en global plafonnerait l'API entière à 10
 * requêtes/heure. D'où ce choix : un `default` large, et des surcharges
 * ciblées là où c'est nécessaire.
 *
 * Toutes les valeurs sont surchargeables par variable d'environnement. En
 * production derrière un reverse proxy, penser à activer `trust proxy` sinon
 * tous les clients partagent l'IP du proxy et se bloquent mutuellement
 * (voir docs/SECURITY.md).
 */

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `${name} doit être un entier strictement positif (reçu : "${raw}")`,
    );
  }

  return parsed;
}

/** Profil global : assez large pour ne gêner aucun usage normal. */
export function getThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: readPositiveInt('THROTTLE_DEFAULT_TTL_SECONDS', 60) * 1000,
        limit: readPositiveInt('THROTTLE_DEFAULT_LIMIT', 120),
      },
    ],
  };
}

/**
 * Connexion : 5 tentatives par quart d'heure.
 * Large pour quelqu'un qui hésite sur son mot de passe, dérisoire pour une
 * attaque par dictionnaire. C'est la surface la plus critique du projet :
 * un compte gérant compromis donne accès à tout l'agenda et aux numéros des
 * clients du salon.
 */
export const AUTH_THROTTLE = {
  default: {
    ttl: readPositiveInt('THROTTLE_AUTH_TTL_SECONDS', 900) * 1000,
    limit: readPositiveInt('THROTTLE_AUTH_LIMIT', 5),
  },
};

/**
 * Création de réservation : 20 par heure et par IP.
 *
 * L'OTP SMS étant écarté (contrainte de gratuité, cf. docs/MVP_SCOPE.md §2.1),
 * rien ne prouve qu'un numéro saisi est réel. Sans plafond, on sature l'agenda
 * d'un salon en quelques secondes.
 *
 * ⚠️ Compromis délicat, à surveiller avec de vrais utilisateurs : les
 * opérateurs mobiles algériens utilisent du CGNAT, donc des dizaines de
 * clients sans lien entre eux peuvent partager la même IP publique. Une limite
 * trop basse bloquerait de vraies réservations, ce qui est bien plus grave
 * qu'un agenda pollué. 20/h est un compromis, pas une valeur démontrée —
 * d'où `THROTTLE_BOOKING_LIMIT` pour l'ajuster sans redéployer.
 *
 * Le vrai rempart anti-abus reste `Client.isBlocked`, appliqué au numéro.
 */
export const BOOKING_THROTTLE = {
  default: {
    ttl: readPositiveInt('THROTTLE_BOOKING_TTL_SECONDS', 3600) * 1000,
    limit: readPositiveInt('THROTTLE_BOOKING_LIMIT', 20),
  },
};

/**
 * Accès par token d'annulation : 30 par heure.
 * Le token est un `cuid` : le deviner par force brute est hors de portée, mais
 * une limite évite d'en faire un oracle utilisable pour sonder l'existence de
 * réservations.
 */
export const TOKEN_THROTTLE = {
  default: {
    ttl: readPositiveInt('THROTTLE_TOKEN_TTL_SECONDS', 3600) * 1000,
    limit: readPositiveInt('THROTTLE_TOKEN_LIMIT', 30),
  },
};
