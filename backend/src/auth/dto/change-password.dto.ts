import { IsString, Length, Matches } from 'class-validator';

/**
 * Changement de mot de passe par le gérant connecté.
 *
 * L'ancien mot de passe est exigé même si l'utilisateur est déjà authentifié :
 * sans ça, un JWT volé (session laissée ouverte sur le poste du salon)
 * permettrait de verrouiller le compte de son propriétaire légitime.
 */
export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  /**
   * 10 caractères minimum, avec au moins une lettre et un chiffre.
   * Volontairement plus exigeant que le mot de passe initial généré par le
   * script : c'est le seul rempart d'un compte qui donne accès à l'agenda
   * complet et aux numéros de téléphone des clients du salon.
   */
  @IsString()
  @Length(10, 128)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre',
  })
  newPassword!: string;
}
