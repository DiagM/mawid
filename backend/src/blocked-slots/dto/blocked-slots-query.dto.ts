import { IsOptional, IsString, Matches } from 'class-validator';

/** Fenêtre de consultation des créneaux bloqués, en dates locales. */
export class BlockedSlotsQueryDto {
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
