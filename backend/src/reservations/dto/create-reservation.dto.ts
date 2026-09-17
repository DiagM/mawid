import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Réservation créée par un client final — aucune authentification.
 *
 * Le `salonId` n'apparaît volontairement pas : il est déduit du slug présent
 * dans l'URL publique, jamais accepté depuis le corps de la requête.
 * De même, aucun prix ni aucune durée n'est accepté du client : tout est
 * recalculé côté serveur depuis les prestations en base.
 */
export class CreateReservationDto {
  /**
   * Début du créneau en ISO 8601 UTC, tel que renvoyé par la route de
   * disponibilité. Revalidé intégralement côté serveur : un créneau affiché
   * comme libre ne prouve rien au moment de l'insertion.
   */
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsArray()
  @ArrayMinSize(1)
  // La borne haute reflète la règle produit (3 prestations max). Elle est
  // revérifiée côté service, qui fait foi si la règle est surchargée par env.
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  prestationIds!: string[];

  @IsString()
  @Length(2, 50)
  clientFirstName!: string;

  /**
   * E.164 algérien. On reste strict sur le préfixe : accepter n'importe quel
   * indicatif international ouvrirait la porte à des réservations
   * intraçables, et le salon ne pourrait pas rappeler le client.
   */
  @IsString()
  @Matches(/^\+213[5-7]\d{8}$/, {
    message: 'Numéro attendu au format +213XXXXXXXXX (mobile algérien)',
  })
  clientPhone!: string;
}
