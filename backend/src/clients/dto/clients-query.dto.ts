import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Segments de clientèle, pensés pour les campagnes.
 *
 * Chacun répond à une question concrète du gérant :
 * - `lapsed`   : « qui ne revient plus ? » — la relance qui rapporte le plus ;
 * - `regulars` : « qui sont mes fidèles ? » — à qui annoncer une nouveauté ;
 * - `all`      : tout le monde.
 */
export const CLIENT_SEGMENTS = ['all', 'lapsed', 'regulars'] as const;
export type ClientSegment = (typeof CLIENT_SEGMENTS)[number];

export class ClientsQueryDto {
  /** Recherche libre sur le prenom ou le numero. */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  q?: string;

  @IsOptional()
  @IsIn(CLIENT_SEGMENTS)
  segment?: ClientSegment;

  /**
   * Ancienneté en jours au-delà de laquelle un client est considéré comme
   * perdu de vue. 60 jours par défaut : au-delà d'une coupe et demie pour un
   * habitué, en deçà on relancerait des gens qui allaient revenir seuls.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  lapsedDays?: number;
}

/**
 * Blocage d'une cliente dans le salon du gérant connecté.
 *
 * Aucun `clientId` ni `salonId` : le premier vient de l'URL, le second du
 * JWT. Un gérant ne doit jamais pouvoir désigner le salon sur lequel il agit.
 */
export class BlockClientDto {
  @IsBoolean()
  isBlocked!: boolean;

  /** Motif privé, jamais montré à la cliente. */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  reason?: string;
}
