/**
 * ============================================
 * Règles de réservation — décisions produit
 * ============================================
 * Ces valeurs ont été arbitrées explicitement (voir `docs/MVP_SCOPE.md` §3.2).
 * Elles vivent ici plutôt qu'éparpillées dans le moteur de disponibilité,
 * parce que ce sont des décisions produit : les changer doit être une ligne à
 * relire, pas une chasse au nombre magique.
 *
 * Surchargeables par variable d'environnement pour pouvoir ajuster en
 * production sans redéployer. En V2, elles deviendront probablement des
 * réglages par salon — d'où le passage par une fonction plutôt que des
 * constantes exportées telles quelles.
 */

export interface BookingRules {
  /** Pas de la grille de créneaux proposés, en minutes. */
  slotStepMinutes: number;
  /** Délai minimum entre maintenant et le début du RDV, en minutes. */
  minLeadMinutes: number;
  /** Nombre de jours réservables à l'avance, aujourd'hui inclus. */
  horizonDays: number;
  /** Durée cumulée maximale d'une réservation, en minutes. */
  maxTotalDurationMinutes: number;
  /** Nombre maximum de prestations dans une même réservation. */
  maxPrestationsPerReservation: number;
  /** RDV à venir qu'un même numéro peut détenir dans un salon donné. */
  maxUpcomingPerPhonePerSalon: number;
  /** Réservations qu'un même numéro peut créer en 24 h, tous salons confondus. */
  maxPerPhonePerDay: number;
}

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

export function getBookingRules(): BookingRules {
  return {
    // 15 min et non 30 : sinon une prestation de 45 min laisse un trou
    // inutilisable de 15 min derrière elle.
    slotStepMinutes: readPositiveInt('BOOKING_SLOT_STEP_MINUTES', 15),
    // Empêche le "je réserve pour dans 5 minutes" auquel le salon ne peut pas
    // répondre puisqu'il ne consulte pas son agenda en continu.
    minLeadMinutes: readPositiveInt('BOOKING_MIN_LEAD_MINUTES', 60),
    horizonDays: readPositiveInt('BOOKING_HORIZON_DAYS', 14),
    // Garde-fou anti-abus : sans OTP, rien n'empêche un plaisantin de bloquer
    // une journée entière en une réservation.
    maxTotalDurationMinutes: readPositiveInt(
      'BOOKING_MAX_TOTAL_DURATION_MINUTES',
      180,
    ),
    maxPrestationsPerReservation: readPositiveInt('BOOKING_MAX_PRESTATIONS', 3),
    // Saturer un agenda demande BEAUCOUP de réservations : plafonner ce qu'un
    // numéro peut détenir simultanément rend l'attaque impossible sans changer
    // de numéro à chaque fois. Un vrai client a rarement 3 RDV à venir dans le
    // même salon, donc la gêne est quasi nulle.
    maxUpcomingPerPhonePerSalon: readPositiveInt(
      'BOOKING_MAX_UPCOMING_PER_PHONE',
      3,
    ),
    // Plafond global par numéro : vise le spam en rafale sur plusieurs salons,
    // que la règle précédente ne verrait pas.
    maxPerPhonePerDay: readPositiveInt('BOOKING_MAX_PER_PHONE_PER_DAY', 5),
  };
}
