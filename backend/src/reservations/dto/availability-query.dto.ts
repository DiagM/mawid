import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Paramètres de la route publique de disponibilité.
 *
 * `prestationIds` arrive en query string : on accepte la forme répétée
 * (`?prestationIds=a&prestationIds=b`) comme la forme séparée par virgules
 * (`?prestationIds=a,b`), parce que les deux sont naturelles côté client et
 * qu'imposer l'une des deux ne ferait que produire des 400 inutiles.
 */
export class AvailabilityQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  date!: string;

  @Transform(({ value }): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap((entry: unknown) =>
        typeof entry === 'string' ? entry.split(',') : [],
      );
    }
    if (typeof value === 'string') {
      return value.split(',');
    }
    return [];
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  prestationIds!: string[];

  /**
   * Membre de l'équipe souhaité (V2). Omis : le moteur propose les créneaux
   * où AU MOINS une ressource est libre, ce qui est le comportement V1 et
   * reste le plus courant — la plupart des clients n'ont pas de préférence.
   */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  employeeId?: string;
}
