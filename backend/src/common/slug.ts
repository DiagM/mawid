/**
 * Slug d'URL à partir d'un nom de salon.
 *
 * C'est l'identité publique du salon (`mawid.dz/karim-barber`), imprimée sur
 * des cartes et partagée sur WhatsApp : il doit rester lisible et stable.
 *
 * La normalisation NFD puis le retrait des diacritiques transforment « Café
 * Beauté » en « cafe-beaute » plutôt qu'en une suite d'échappements.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Slugs que le frontend utilise pour ses propres pages.
 *
 * La fiche publique d'un salon vit à la racine (`mawid.dz/karim-barber`),
 * donc un salon qui obtiendrait l'un de ces slugs serait purement et
 * simplement inaccessible : Next donne la priorité à sa route statique sur
 * la route dynamique `[slug]`. Le salon existerait, paierait peut-être, et
 * son lien renverrait une autre page.
 *
 * À tenir à jour en même temps que les routes de `frontend/app/`.
 */
export const RESERVED_SLUGS = new Set([
  'pro',
  'admin',
  'r',
  'pour-les-salons',
  'api',
  'sitemap',
  'robots',
  'manifest',
]);

/**
 * Rend un slug unique en le suffixant.
 *
 * @param isTaken prédicat asynchrone d'existence en base
 *
 * La borne de tentatives évite une boucle infinie si le prédicat se met à
 * renvoyer `true` en permanence (base indisponible, par exemple) : mieux vaut
 * échouer franchement que boucler.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const root = slugify(base) || 'salon';

  if (!RESERVED_SLUGS.has(root) && !(await isTaken(root))) {
    return root;
  }

  for (let suffix = 2; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!RESERVED_SLUGS.has(candidate) && !(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Impossible de générer un slug unique à partir de "${base}"`);
}
