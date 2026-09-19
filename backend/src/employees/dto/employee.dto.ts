import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { OpeningHoursDto } from '../../salons/dto/opening-hours.dto';

/**
 * Membre de l'équipe d'un salon (V2).
 *
 * Aucun `salonId` : il est déduit du JWT, comme partout ailleurs
 * (CLAUDE.md §3.2).
 */
export class CreateEmployeeDto {
  @IsString()
  @Length(2, 80)
  fullName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  displayOrder?: number;

  /**
   * Horaires individuels. Omis ou `null` : l'employé suit les horaires du
   * salon, ce qui est le cas courant — un employé à temps partiel est
   * l'exception, pas la règle.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  workingHours?: OpeningHoursDto | null;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  fullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  workingHours?: OpeningHoursDto | null;
}
