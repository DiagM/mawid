import { IsIn, IsOptional, IsString, Length } from 'class-validator';

/**
 * Transitions de statut autorisées au gérant depuis son agenda.
 *
 * `CONFIRMED` est volontairement absent : re-confirmer un RDV annulé
 * ressusciterait un créneau que la contrainte d'exclusion a pu entre-temps
 * attribuer à quelqu'un d'autre. Le bon geste est de recréer une réservation.
 */
export const MANAGER_STATUS_TRANSITIONS = [
  'HONORED',
  'NO_SHOW',
  'CANCELED',
] as const;

export type ManagerStatusTransition =
  (typeof MANAGER_STATUS_TRANSITIONS)[number];

export class UpdateReservationStatusDto {
  @IsIn(MANAGER_STATUS_TRANSITIONS)
  status!: ManagerStatusTransition;

  /** Note privée du gérant, jamais exposée au client. */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  internalNote?: string;
}
