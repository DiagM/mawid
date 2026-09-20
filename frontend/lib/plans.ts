/**
 * ============================================
 * Ce que chaque offre débloque — côté interface
 * ============================================
 * Miroir de `backend/src/common/plans.ts`. La duplication est assumée : le
 * frontend a besoin de cette carte pour décider quoi verrouiller AVANT
 * d'appeler l'API, et l'exposer par une route ajouterait un aller-retour sur
 * chaque écran pour une valeur qui change une fois par an.
 *
 * ⚠️ Ce fichier ne protège rien. Le backend refait le contrôle et fait foi ;
 * ici on évite seulement de présenter un menu qui mène à un refus.
 */

export type PlanName = 'FREE' | 'PRO' | 'PRO_PLUS';

export type GatedModule = 'clients' | 'cash' | 'stock';

interface Capabilities {
  maxEmployees: number | null;
  clients: boolean;
  statsMonths: number | null;
  cash: boolean;
  stock: boolean;
}

export const PLAN_CAPABILITIES: Record<PlanName, Capabilities> = {
  FREE: {
    maxEmployees: 1,
    clients: false,
    statsMonths: 1,
    cash: false,
    stock: false,
  },
  PRO: {
    maxEmployees: null,
    clients: true,
    statsMonths: null,
    cash: false,
    stock: false,
  },
  PRO_PLUS: {
    maxEmployees: null,
    clients: true,
    statsMonths: null,
    cash: true,
    stock: true,
  },
};

/** Offre minimale débloquant chaque module, pour l'argumentaire affiché. */
export const REQUIRED_PLAN: Record<GatedModule, PlanName> = {
  clients: 'PRO',
  cash: 'PRO_PLUS',
  stock: 'PRO_PLUS',
};

export const PLAN_LABELS: Record<PlanName, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  PRO_PLUS: 'Pro+',
};

export function hasModule(plan: PlanName, module: GatedModule): boolean {
  return PLAN_CAPABILITIES[plan][module];
}
