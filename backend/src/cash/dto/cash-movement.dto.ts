import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export const CASH_TYPES = ['SALE', 'EXPENSE'] as const;
export const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER'] as const;

export class CreateCashMovementDto {
  @IsIn(CASH_TYPES)
  type!: 'SALE' | 'EXPENSE';

  /**
   * Montant en centimes DZD, TOUJOURS positif : c'est `type` qui porte le
   * sens. Autoriser du negatif ouvrirait la porte a une depense enregistree
   * en recette et a des totaux impossibles a auditer.
   *
   * Borne haute a 100 millions de centimes (1 million de DA) : au-dela c'est
   * une faute de frappe, pas un encaissement de salon.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents!: number;

  @IsString()
  @Length(2, 120)
  label!: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: 'CASH' | 'CARD' | 'TRANSFER';

  /** Rendez-vous encaisse, pour eviter une double saisie. */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  reservationId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  employeeId?: string;

  /** Date de l'encaissement. Omise : maintenant. */
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;
}

export class CashDayQueryDto {
  @IsOptional()
  @IsString()
  @Length(10, 10)
  date?: string;
}
