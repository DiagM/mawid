import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CITIES } from '../../common/cities';

/**
 * Villes ouvertes à la recherche : la liste partagée du produit.
 * Voir `common/cities.ts` pour la raison de sa fermeture.
 */
export const SEARCHABLE_CITIES = CITIES;

export class SearchSalonsDto {
  @IsOptional()
  @IsIn(SEARCHABLE_CITIES)
  city?: string;

  /** Recherche libre : nom du salon, quartier, ou nom d'une prestation. */
  @IsOptional()
  @IsString()
  @Length(2, 60)
  q?: string;

  /**
   * Filtre « 100 % féminin ». Une query string ne transporte que du texte :
   * on accepte `true`/`1` et on ignore le reste, plutôt que de rejeter la
   * requête pour une casse inattendue.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  womenOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
