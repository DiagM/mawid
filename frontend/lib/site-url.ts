/**
 * URL publique canonique du site.
 *
 * Utilisée par le sitemap, `robots.txt` et les métadonnées Open Graph, qui
 * ont tous besoin d'URL absolues. Contrairement à `getRequestOrigin()`, cette
 * valeur ne dépend pas d'une requête entrante : elle doit rester identique
 * quel que soit le domaine par lequel on arrive, sinon les moteurs indexeraient
 * plusieurs variantes de la même page.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    // Sans cette normalisation, une barre finale produirait des `//` dans
    // toutes les URL générées.
    return configured.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}
