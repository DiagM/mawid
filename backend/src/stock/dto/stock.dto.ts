import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  /** Unite affichee : « flacon », « boite », « ml »... */
  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit?: string;

  /** Prix d'achat unitaire, en centimes DZD entiers (CLAUDE.md §3.5). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  costCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  costCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateStockMovementDto {
  /**
   * Signe : positif pour une entree, negatif pour une sortie.
   * Borne pour qu'une faute de frappe ne fasse pas basculer un stock entier.
   */
  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  delta!: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  reason?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;
}
