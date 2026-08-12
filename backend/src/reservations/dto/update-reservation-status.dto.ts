import { IsEnum } from 'class-validator';

/**
 * Statuts qu'un gérant peut manuellement assigner à une réservation.
 * Volontairement plus restreint que ReservationStatus (Prisma) : on ne
 * permet PAS de repasser en CONFIRMED ni de forcer un CANCELED via cette
 * route (l'annulation passe par la route publique dédiée /token/:token/cancel).
 */
export enum ReservationStatusUpdateValue {
  HONORED = 'HONORED',
  NO_SHOW = 'NO_SHOW',
}

export class UpdateReservationStatusDto {
  @IsEnum(ReservationStatusUpdateValue, {
    message: 'status doit être HONORED ou NO_SHOW',
  })
  status!: ReservationStatusUpdateValue;
}
