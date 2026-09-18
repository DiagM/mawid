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

  if (!(await isTaken(root))) {
    return root;
  }

  for (let suffix = 2; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Impossible de générer un slug unique à partir de "${base}"`);
}
