import { IsOptional, IsString, Length } from 'class-validator';

export class ClientsQueryDto {
  /** Recherche libre sur le prenom ou le numero. */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  q?: string;
}
