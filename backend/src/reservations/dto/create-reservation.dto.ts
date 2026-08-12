import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateReservationDto {
  /**
   * IDs des prestations choisies (au moins une).
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une prestation est requise' })
  @IsString({ each: true })
  prestationIds!: string[];

  /**
   * Date/heure de début du rendez-vous, au format ISO 8601.
   * Interprétée comme un instant UTC (le frontend envoie déjà l'heure
   * convertie en UTC ; ce backend ne fait aucune conversion sur ce champ).
   */
  @IsISO8601({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt!: string;

  @IsString()
  @MinLength(2, { message: 'Le prénom doit faire au moins 2 caractères' })
  @MaxLength(50)
  clientFirstName!: string;

  /**
   * Numéro de téléphone algérien, format E.164.
   * Préfixes mobiles valides : 5 (Djezzy), 6 (Mobilis), 7 (Ooredoo).
   */
  @IsString()
  @Matches(/^\+213[5-7]\d{8}$/, {
    message:
      'Numéro de téléphone algérien invalide (format attendu : +213XXXXXXXXX)',
  })
  clientPhone!: string;
}
