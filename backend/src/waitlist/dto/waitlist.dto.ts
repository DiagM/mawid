import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Inscription d'une cliente sur la liste d'attente d'une journée.
 *
 * Aucun `salonId` : il vient du slug public. Aucun créneau non plus — s'il y
 * en avait un de libre, elle aurait réservé.
 */
export class JoinWaitlistDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  desiredDate!: string;

  /**
   * Les prestations souhaitées servent à deux choses : vérifier que la
   * journée est bien complète POUR CETTE DEMANDE, et donner au gérant la
   * durée nécessaire — un créneau de trente minutes qui se libère ne peut
   * pas accueillir une demande d'une heure et demie.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  prestationIds!: string[];

  @IsString()
  @Length(2, 50)
  clientFirstName!: string;

  @IsString()
  @Matches(/^\+213[5-7]\d{8}$/, {
    message: 'Numéro attendu au format +213XXXXXXXXX (mobile algérien)',
  })
  clientPhone!: string;

  /** Précision libre : « plutôt le matin », « après 17h ». */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  note?: string;

  /** Piège à robots (docs/SECURITY.md §1.1). Doit rester vide. */
  @IsOptional()
  @IsEmpty({ message: 'Requête invalide' })
  website?: string;
}

/** Fenêtre consultée par le gérant. Omise : les 30 jours à venir. */
export class WaitlistQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  to?: string;
}

/**
 * Marque une demande comme traitée.
 *
 * On garde la ligne plutôt que de la supprimer : sans trace, le gérant
 * rappellerait deux fois la même personne.
 */
export class MarkNotifiedDto {
  @IsBoolean()
  notified!: boolean;
}
