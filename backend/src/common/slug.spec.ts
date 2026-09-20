import { RESERVED_SLUGS, slugify, uniqueSlug } from './slug';

/** Aucun slug pris en base : isole la logique des slugs réservés. */
const nothingTaken = () => Promise.resolve(false);

describe('slugify', () => {
  it('retire les accents plutôt que de les échapper', () => {
    // « Café Beauté » doit donner une URL lisible, imprimable sur une carte
    // de visite, pas une suite de séquences d'échappement.
    expect(slugify('Café Beauté')).toBe('cafe-beaute');
    expect(slugify('Institut Élégance')).toBe('institut-elegance');
  });

  it('réduit la ponctuation à des tirets simples', () => {
    expect(slugify('Karim  &  Fils !!')).toBe('karim-fils');
    expect(slugify('  --Salon--  ')).toBe('salon');
  });

  it('borne la longueur', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(60);
  });
});

describe('uniqueSlug', () => {
  it('rend le slug tel quel quand il est libre', async () => {
    expect(await uniqueSlug('Karim Barber', nothingTaken)).toBe('karim-barber');
  });

  it('suffixe quand le slug est déjà pris', async () => {
    const taken = (candidate: string) =>
      Promise.resolve(candidate === 'karim-barber');

    expect(await uniqueSlug('Karim Barber', taken)).toBe('karim-barber-2');
  });

  it('refuse les slugs réservés par le frontend', async () => {
    // Un salon nommé « Pro » obtiendrait le slug `pro`, et sa fiche serait
    // inaccessible : Next sert sa route statique `/pro` en priorité sur la
    // route dynamique `[slug]`. Le salon existerait sans être joignable.
    expect(await uniqueSlug('Pro', nothingTaken)).toBe('pro-2');
    expect(await uniqueSlug('Admin', nothingTaken)).toBe('admin-2');
  });

  it.each([...RESERVED_SLUGS])(
    'n’attribue jamais « %s » tel quel',
    async (reserved) => {
      expect(await uniqueSlug(reserved, nothingTaken)).not.toBe(reserved);
    },
  );

  it('retombe sur « salon » quand le nom ne donne aucun caractère utile', async () => {
    expect(await uniqueSlug('!!! ???', nothingTaken)).toBe('salon');
  });

  it('échoue franchement plutôt que de boucler', async () => {
    // Base indisponible ou prédicat cassé : mieux vaut une erreur lisible
    // qu'une boucle infinie dans une transaction d'inscription.
    await expect(
      uniqueSlug('Karim', () => Promise.resolve(true), 5),
    ).rejects.toThrow(/Impossible de générer un slug unique/);
  });
});
