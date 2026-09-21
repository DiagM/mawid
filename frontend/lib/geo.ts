/**
 * Distance lisible par un humain.
 *
 * Duplique volontairement `backend/src/common/geo.ts`, comme `lib/plans.ts`
 * duplique la carte des offres : le rendu doit se faire sans aller-retour
 * réseau, et la règle d'affichage ne change jamais.
 *
 * En dessous du kilomètre on arrondit à 50 m près. Une épingle posée à la
 * main sur une carte vaut ±50 m au mieux : annoncer « à 237 m » promettrait
 * une précision qui n'existe pas.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  }

  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}
