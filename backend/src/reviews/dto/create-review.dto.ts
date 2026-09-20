import { Type } from 'class-transformer';
import {
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Avis déposé par un client.
 *
 * Aucun identifiant de salon, de réservation ni de client : tout est déduit du
 * `cancellationToken` présent dans l'URL. Le client ne peut donc noter que le
 * rendez-vous dont il détient le lien, et rien d'autre.
 */
export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  comment?: string;

  /** Piège à robots (docs/SECURITY.md §1.1). */
  @IsOptional()
  @IsEmpty({ message: 'Requête invalide' })
  website?: string;
}
