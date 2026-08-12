import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Un blocage manuel de créneau par le gérant (pause, RDV perso, fermeture
 * exceptionnelle...). La cohérence endsAt > startsAt est vérifiée côté
 * service (validation cross-champ non triviale avec class-validator seul).
 */
export class CreateBlockedSlotDto {
  @IsISO8601({}, { message: 'startsAt doit être une date ISO 8601 valide' })
  startsAt!: string;

  @IsISO8601({}, { message: 'endsAt doit être une date ISO 8601 valide' })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
