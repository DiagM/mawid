/**
 * ============================================
 * Villes couvertes (V4)
 * ============================================
 * Liste **fermée** et volontairement courte. Accepter une chaîne libre
 * laisserait s'accumuler « alger », « Alger », « ALGER » et « Algers » comme
 * quatre villes distinctes — la recherche par ville deviendrait inutilisable
 * et le référencement produirait des pages de résultats vides.
 *
 * L'ouverture d'une ville est une décision commerciale : il faut des salons
 * avant d'ouvrir la recherche, sinon le premier visiteur tombe sur une page
 * vide et ne revient pas. On n'ajoute donc une entrée ici qu'au moment
 * d'ouvrir réellement la ville.
 */
export const CITIES = ['Alger', 'Oran', 'Constantine'] as const;

export type City = (typeof CITIES)[number];

/** Ville par défaut, celle du marché initial. */
export const DEFAULT_CITY: City = 'Alger';

export function isCity(value: unknown): value is City {
  return typeof value === 'string' && CITIES.includes(value as City);
}
