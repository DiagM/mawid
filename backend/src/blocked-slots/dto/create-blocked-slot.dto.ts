import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

/**
 * Créneau bloqué par le gérant (pause, RDV perso, jour d'absence).
 *
 * Aucun `salonId` : il est déduit du JWT.
 *
 * `employeeId` est en revanche accepté depuis le lot 9. Omis, le blocage vaut
 * pour tout le salon — c'est le comportement historique et celui d'un salon
 * sans équipe. Renseigné, seul ce membre devient indisponible : un salon de
 * trois personnes ne doit pas fermer parce que l'une d'elles est absente.
 * L'identifiant est revalidé côté service, un membre d'un autre salon est
 * refusé.
 */
export class CreateBlockedSlotDto {
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsISO8601({ strict: true })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  employeeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
}
