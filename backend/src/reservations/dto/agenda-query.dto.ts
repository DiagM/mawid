import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Fenêtre de l'agenda gérant. Les deux bornes sont des dates LOCALES
 * (`YYYY-MM-DD`) : le gérant raisonne en jours de travail, pas en instants UTC.
 * Bornes omises = la journée en cours.
 */
export class AgendaQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date attendue au format YYYY-MM-DD',
  })
  to?: string;
}
