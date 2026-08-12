import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * Numéro de téléphone au format international E.164
   * Ex : +213555100001
   */
  @IsNotEmpty({ message: 'Le numéro de téléphone est requis' })
  @IsString()
  @Matches(/^\+\d{8,15}$/, {
    message: 'Le numéro doit être au format international (ex: +213555100001)',
  })
  phone!: string;

  /**
   * Mot de passe en clair (sera comparé au hash bcrypt en base)
   */
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  password!: string;
}
