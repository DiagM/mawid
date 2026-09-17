import {
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OpeningHoursDto } from './opening-hours.dto';

/**
 * Champs modifiables d'un salon par son gérant.
 * Tous optionnels (PATCH = mise à jour partielle).
 */
export class UpdateSalonDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom doit faire au moins 2 caractères' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsLatitude({ message: 'Latitude invalide' })
  latitude?: number | null;

  @IsOptional()
  @IsLongitude({ message: 'Longitude invalide' })
  longitude?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
