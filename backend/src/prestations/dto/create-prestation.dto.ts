import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePrestationDto {
  @IsNotEmpty({ message: 'Le nom est requis' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Durée en minutes. Min 5 (pour éviter les valeurs absurdes),
   * max 480 (8h, limite raisonnable pour une seule prestation).
   */
  @IsInt({ message: 'La durée doit être un entier' })
  @Min(5, { message: 'Durée minimale : 5 minutes' })
  @Max(480, { message: 'Durée maximale : 480 minutes (8h)' })
  durationMinutes!: number;

  /**
   * Prix en centimes DZD (1500 = 15 DZD).
   * Min 0 (prestations gratuites possibles : essai, courtoisie).
   * Max 10 000 000 centimes = 100 000 DZD (limite sanity check).
   */
  @IsInt({ message: 'Le prix doit être un entier (en centimes)' })
  @Min(0)
  @Max(10_000_000)
  priceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
