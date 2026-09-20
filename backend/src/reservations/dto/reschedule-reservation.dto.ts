import {
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Déplacement d'un rendez-vous existant.
 *
 * Ni prix ni durée : les snapshots de `ReservationPrestation` ne bougent pas.
 * Déplacer un rendez-vous ne renégocie pas ce qui a été convenu — si le tarif
 * du salon a changé entre-temps, la cliente garde celui de sa réservation
 * initiale.
 */
export class RescheduleReservationDto {
  @IsISO8601({ strict: true })
  startsAt!: string;

  /**
   * Changer de membre d'équipe en même temps que de créneau. Omis, le moteur
   * choisit lui-même une ressource libre — y compris celle d'origine si elle
   * l'est toujours.
   */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  employeeId?: string;
}

/**
 * Jour pour lequel proposer des créneaux de report.
 *
 * Pas de `prestationIds`, contrairement à la disponibilité publique : les
 * prestations sont celles de la réservation, et les accepter depuis l'URL
 * permettrait de changer le contenu du rendez-vous en le déplaçant.
 */
export class RescheduleAvailabilityQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  date!: string;
}
