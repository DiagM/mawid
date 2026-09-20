import { IsOptional, IsString, Matches } from 'class-validator';

/** Fenetre d'analyse, en dates locales. Sans bornes : les 30 derniers jours. */
export class StatsQueryDto {
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
