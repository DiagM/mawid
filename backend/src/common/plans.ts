import { ForbiddenException } from '@nestjs/common';
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

/**
 * ============================================
 * Ce que chaque offre débloque
 * ============================================
 * Source unique de vérité du conditionnement par offre. Chaque service
 * concerné appelle `assertCapability` ; l'interface lit la même carte pour
 * savoir quoi verrouiller. Deux listes séparées auraient dérivé au premier
 * changement de grille.
 *
 * ⚠️ Règle qui a guidé le découpage : **ne jamais dégrader l'expérience de
 * la cliente.** Le quota mensuel le fait déjà, et c'est la seule exception
 * assumée du produit. Tout le reste ne verrouille que le confort du gérant —
 * une cliente peut réserver, annuler et noter son rendez-vous à l'identique
 * quelle que soit l'offre de son salon.
 *
 * Corollaire sur les déclassements : un verrou empêche d'AJOUTER, jamais
 * d'accéder à l'existant. Un salon qui repasse en Gratuit avec trois membres
 * les garde ; il ne peut simplement plus en créer. Un déclassement qui
 * casserait l'agenda transformerait chaque fin d'abonnement en catastrophe.
 */
export interface PlanCapabilities {
  /** Réservations en ligne par mois. `null` = illimité. */
  monthlyReservations: number | null;
  /** Membres d'équipe **actifs**. `null` = illimité. */
  maxEmployees: number | null;
  /** Fiches clientes, segments, et donc les relances WhatsApp. */
  clients: boolean;
  /** Profondeur d'historique des statistiques, en mois. `null` = illimitée. */
  statsMonths: number | null;
  /** Module caisse. */
  cash: boolean;
  /** Module stocks. */
  stock: boolean;
}

export const PLAN_CAPABILITIES: Record<SalonPlan, PlanCapabilities> = {
  // « Être en ligne ». Volontairement utilisable seul : sans concurrent en
  // Algérie, l'adoption prime sur la monétisation précoce, et une offre
  // gratuite mutilée ne convertit pas — elle ne se fait pas installer.
  FREE: {
    monthlyReservations: 30,
    maxEmployees: 1,
    clients: false,
    statsMonths: 1,
    cash: false,
    stock: false,
  },
  // « Faire tourner le salon ». Ce qui se débloque ici n'a de sens que
  // lorsque le salon marche : une équipe, une clientèle à relancer.
  PRO: {
    monthlyReservations: null,
    maxEmployees: null,
    clients: true,
    statsMonths: null,
    cash: false,
    stock: false,
  },
  // « Piloter le commerce ».
  PRO_PLUS: {
    monthlyReservations: null,
    maxEmployees: null,
    clients: true,
    statsMonths: null,
    cash: true,
    stock: true,
  },
};

/** Offre minimale débloquant une capacité booléenne, pour le message d'appel. */
const REQUIRED_PLAN: Record<'clients' | 'cash' | 'stock', SalonPlan> = {
  clients: 'PRO',
  cash: 'PRO_PLUS',
  stock: 'PRO_PLUS',
};

const PLAN_LABELS: Record<SalonPlan, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  PRO_PLUS: 'Pro+',
};

export function capabilitiesFor(plan: SalonPlan): PlanCapabilities {
  return PLAN_CAPABILITIES[plan];
}

/**
 * Refuse l'accès à un module non compris dans l'offre du salon.
 *
 * Le message nomme l'offre requise : un refus qui n'indique pas quoi faire
 * ensuite ressemble à une panne, et ne vend rien.
 */
export function assertCapability(
  plan: SalonPlan,
  capability: 'clients' | 'cash' | 'stock',
): void {
  if (PLAN_CAPABILITIES[plan][capability]) {
    return;
  }

  throw new ForbiddenException(
    `Ce module est inclus dans l'offre ${PLAN_LABELS[REQUIRED_PLAN[capability]]}. ` +
      'Contactez Mawid pour y passer.',
  );
}

/**
 * Refuse la création d'un membre au-delà du plafond de l'offre.
 *
 * Compté sur les membres **actifs** : archiver quelqu'un doit libérer une
 * place, sinon un salon qui change d'employé resterait bloqué à vie.
 */
export function assertEmployeeQuota(
  plan: SalonPlan,
  activeCount: number,
): void {
  const max = PLAN_CAPABILITIES[plan].maxEmployees;

  if (max === null || activeCount < max) {
    return;
  }

  throw new ForbiddenException(
    max === 1
      ? "L'offre Gratuite gère une seule personne. Passez à l'offre Pro pour " +
          'travailler à plusieurs en parallèle.'
      : `Votre offre est limitée à ${max} membres d'équipe.`,
  );
}

/**
 * `null` = illimité.
 *
 * Dérivé de `PLAN_CAPABILITIES` plutôt que redéclaré : deux listes de quotas
 * auraient fini par diverger, et la divergence ne se verrait qu'au moment où
 * un client serait refusé à tort.
 */
export const MONTHLY_RESERVATION_QUOTA: Record<SalonPlan, number | null> = {
  FREE: PLAN_CAPABILITIES.FREE.monthlyReservations,
  PRO: PLAN_CAPABILITIES.PRO.monthlyReservations,
  PRO_PLUS: PLAN_CAPABILITIES.PRO_PLUS.monthlyReservations,
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
