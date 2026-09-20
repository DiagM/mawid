import { randomBytes } from 'node:crypto';

/**
 * Mot de passe initial d'un compte gérant.
 *
 * 16 caractères tirés de `crypto.randomBytes` et non de `Math.random` : ce
 * secret protège l'agenda complet d'un salon et les numéros de téléphone de
 * toutes ses clientes.
 *
 * L'alphabet exclut `l`, `I`, `O`, `0` et `1` : ce mot de passe est souvent
 * dicté au téléphone ou recopié depuis un écran, et une confusion de
 * caractère coûte un appel au support.
 */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 16): string {
  const bytes = randomBytes(length);

  return Array.from(bytes)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
}
