import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmpty,
  IsISO8601,
  IsOptional,
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

  /**
   * Piège à robots ("honeypot"). Ce champ doit rester vide : il est masqué en
   * CSS côté front, un humain ne le voit jamais, mais un robot qui remplit
   * aveuglément tous les champs d'un formulaire le renseigne.
   *
   * Nommé `website` et non `email` à dessein : le remplissage automatique des
   * navigateurs adore les champs e-mail, et bloquerait alors de vrais clients.
   * Le front doit le rendre avec `autocomplete="off"` et `tabindex="-1"` pour
   * qu'il reste invisible, y compris à la navigation au clavier.
   *
   * L'erreur renvoyée est une 400 de validation ordinaire, indiscernable des
   * autres : inutile d'annoncer au robot qu'il a été repéré.
   */
  @IsOptional()
  @IsEmpty({ message: 'Requête invalide' })
  website?: string;
}
