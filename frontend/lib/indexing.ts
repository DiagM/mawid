/**
 * Autorisation d'indexation par les moteurs de recherche.
 *
 * Tant que le catalogue est vide et que l'adresse definitive n'est pas
 * arretee, laisser Google explorer coute deux fois : il reference un site
 * sans salon, et l'adresse Netlify reste dans l'index le jour ou le produit
 * passe sur son propre domaine.
 *
 * Le defaut est donc BLOQUANT : il faut poser `MAWID_ALLOW_INDEXING=true`
 * pour ouvrir. Le choix du sens n'est pas neutre — un oubli laisse le site
 * discret, ce qui se repare en une variable ; l'oubli inverse laisse des URL
 * dans l'index de Google, qu'on ne retire pas d'un claquement de doigts.
 *
 * ⚠️ A poser le jour du lancement, sinon le site ne sera JAMAIS reference.
 * `robots.ts` et `sitemap.ts` sont generes a la construction : changer la
 * variable sans redeployer n'a aucun effet.
 */
export function isIndexingAllowed(): boolean {
  return process.env.MAWID_ALLOW_INDEXING?.trim().toLowerCase() === 'true';
}
