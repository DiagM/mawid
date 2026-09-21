/**
 * Lien d'itinéraire vers Google Maps.
 *
 * URL universelle documentée par Google : aucune clé, aucun quota, aucun
 * script tiers chargé dans la page. Sur téléphone elle ouvre l'application
 * Maps, sur ordinateur le site.
 *
 * On préfère TOUJOURS les coordonnées à l'adresse quand elles existent : les
 * adresses algériennes ne sont pas normalisées, et « rue dieh mohamed
 * bouzareah » envoie Google chercher au jugé. Une destination approximative
 * fait perdre une cliente aussi sûrement qu'un lien absent.
 */
export function directionsUrl(input: {
  latitude: number | null;
  longitude: number | null;
  addressLine: string;
  district: string;
  city: string;
}): string {
  const query =
    input.latitude !== null && input.longitude !== null
      ? `${input.latitude},${input.longitude}`
      : `${input.addressLine}, ${input.district}, ${input.city}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
