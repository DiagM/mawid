import {
  IsArray,
  IsIn,
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
import { CITIES, type City } from '../../common/cities';

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

  /** Ville (V4 : multi-villes). Liste fermée, voir common/cities.ts. */
  @IsOptional()
  @IsIn(CITIES)
  city?: City;

  /**
   * Lien Google Maps du salon, d'ou l'on tire la position.
   *
   * Personne ne connait sa latitude ; tout le monde sait partager son
   * lien Maps. Le serveur en extrait le point, y compris pour un lien
   * court `maps.app.goo.gl` dont il suit la redirection.
   *
   * Chaine vide = retirer la position. Appliquee APRES `latitude` et
   * `longitude` : si les deux arrivent, c'est le lien qui fait foi,
   * puisque c'est lui que le formulaire propose.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mapsUrl?: string;

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
