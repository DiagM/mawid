import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query params de GET /api/salons/:slug/availability
 * Ex: ?prestationIds=a,b&days=7
 */
export class AvailabilityQueryDto {
  /**
   * Liste d'IDs de prestations séparés par des virgules (pas de tableau
   * natif possible proprement en query string GET).
   */
  @IsNotEmpty({ message: 'prestationIds est requis' })
  @IsString()
  prestationIds!: string;

  /**
   * Nombre de jours à explorer (défaut 7, plafonné à 14 côté service).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  days?: number;
}
