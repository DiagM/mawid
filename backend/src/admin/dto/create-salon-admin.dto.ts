import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OpeningHoursDto } from '../../salons/dto/opening-hours.dto';

/**
 * Création d'un salon (+ son compte gérant) par l'admin plateforme.
 * En V1, l'admin est le seul à onboarder de nouveaux salons (pas
 * d'inscription self-service côté gérant).
 */
export class CreateSalonAdminDto {
  @IsString()
  @Matches(/^\+213[5-7]\d{8}$/, {
    message:
      'Numéro de téléphone algérien invalide (format attendu : +213XXXXXXXXX)',
  })
  ownerPhone!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @MaxLength(72) // limite pratique de bcrypt
  ownerPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerFullName?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug invalide (minuscules, chiffres et tirets uniquement, ex: "karim-barber")',
  })
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  addressLine!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours!: OpeningHoursDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
