import { BadRequestException } from '@nestjs/common';

/**
 * Saisie locale → E.164, seul format stocké (CLAUDE.md §3.3).
 *
 * Un gérant tape « 0555 12 34 56 », un autre « +213555123456 » : stocker les
 * deux tels quels créerait deux comptes pour la même personne, et la
 * connexion échouerait une fois sur deux. La normalisation est donc faite au
 * plus près de l'entrée, jamais à la comparaison.
 *
 * Les DTO ont déjà validé la forme ; il ne reste ici qu'à unifier le préfixe.
 */
export function toE164(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, '');
  const national = /^(?:\+213|00213|0)([5-7]\d{8})$/.exec(digits);

  if (!national) {
    throw new BadRequestException('Numéro de mobile algérien attendu');
  }

  return `+213${national[1]}`;
}
