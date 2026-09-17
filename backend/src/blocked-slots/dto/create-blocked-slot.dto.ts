import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

/**
 * Créneau bloqué par le gérant (pause, RDV perso, fermeture exceptionnelle).
 *
 * Aucun `salonId` : il est déduit du JWT. Aucun `employeeId` non plus en V1 —
 * un blocage vaut pour tout le salon tant que le multi-employés n'est pas
 * activé, et accepter cet identifiant maintenant reviendrait à exposer une
 * fonctionnalité que le moteur ne sait pas encore arbitrer côté base.
 */
export class CreateBlockedSlotDto {
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
}
