import type { SalonPlan } from '@prisma/client';

/**
 * ============================================
 * Offres commerciales et quotas
 * ============================================
 * Grille tarifaire du business plan §8.1 : Free limité à 30 rendez-vous par
 * mois, Pro et Pro+ illimités.
 *
 * ⚠️ Décision produit lourde, à connaître avant de toucher à ces valeurs :
 * atteindre le quota fait **refuser des clients réels**, qui n'y sont pour
 * rien. C'est le mécanisme de conversion voulu — un salon qui perd des
 * réservations a une raison concrète de passer au plan Pro — mais c'est aussi
 * la seule fonctionnalité du produit qui dégrade volontairement l'expérience
 * du client final.
 *
 * Deux garde-fous en découlent :
 * 1. le gérant est averti bien avant d'y arriver (`WARNING_THRESHOLD`) ;
 * 2. le message renvoyé au client ne lui reproche rien et le renvoie vers le
 *    salon, qui peut toujours le prendre par téléphone.
 */

/** `null` = illimité. */
export const MONTHLY_RESERVATION_QUOTA: Record<SalonPlan, number | null> = {
  FREE: 30,
  PRO: null,
  PRO_PLUS: null,
};

/**
 * Part du quota à partir de laquelle on alerte le gérant.
 * 80 % laisse le temps de réagir : à 30 RDV/mois, l'alerte tombe au 24e,
 * soit généralement une semaine avant la fin du mois.
 */
export const QUOTA_WARNING_THRESHOLD = 0.8;

export interface QuotaStatus {
  plan: SalonPlan;
  /** `null` = illimité, aucun blocage possible. */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Le prochain client serait refusé. */
  isExceeded: boolean;
  /** Assez proche de la limite pour prévenir le gérant. */
  isNearLimit: boolean;
  /** Premier jour du mois suivant : date de remise à zéro. */
  resetsAt: string;
}

export function buildQuotaStatus(
  plan: SalonPlan,
  used: number,
  resetsAt: Date,
): QuotaStatus {
  const limit = MONTHLY_RESERVATION_QUOTA[plan];

  if (limit === null) {
    return {
      plan,
      limit: null,
      used,
      remaining: null,
      isExceeded: false,
      isNearLimit: false,
      resetsAt: resetsAt.toISOString(),
    };
  }

  return {
    plan,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    isExceeded: used >= limit,
    isNearLimit: used >= limit * QUOTA_WARNING_THRESHOLD,
    resetsAt: resetsAt.toISOString(),
  };
}
