import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CITIES, type City } from '../../common/cities';

export const SALON_STATUS_FILTERS = ['all', 'pending', 'active'] as const;
export type SalonStatusFilter = (typeof SALON_STATUS_FILTERS)[number];

export const SALON_PLANS = ['FREE', 'PRO', 'PRO_PLUS'] as const;
export type SalonPlanValue = (typeof SALON_PLANS)[number];

/** Filtres de la liste des salons de la console. */
export class AdminSalonsQueryDto {
  @IsOptional()
  @IsIn(SALON_STATUS_FILTERS)
  status?: SalonStatusFilter;

  /** Recherche libre sur le nom, le slug ou le numéro du gérant. */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  q?: string;
}

/**
 * Actions commerciales sur un salon.
 *
 * Les trois champs correspondent exactement aux gestes qui se faisaient
 * jusqu'ici en ligne de commande : valider un salon, changer son offre,
 * vendre une mise en avant.
 */
export class UpdateSalonAdminDto {
  /** Validation manuelle : c'est ce qui rend l'inscription libre acceptable. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(SALON_PLANS)
  plan?: SalonPlanValue;

  /**
   * Mise en avant vendue à la semaine. `0` la retire immédiatement.
   * Bornée à 52 : au-delà, c'est une erreur de saisie, pas une vente.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(52)
  featuredWeeks?: number;
}

/**
 * Création d'un gérant et de son salon par la plateforme.
 *
 * Reprend `prisma/create-manager.ts`, à deux différences près : le slug est
 * dérivé du nom et rendu unique automatiquement, et le mot de passe est
 * toujours généré. Laisser choisir un mot de passe depuis une interface
 * reviendrait à ce que deux personnes connaissent durablement le secret.
 */
export class CreateManagerDto {
  @IsString()
  @Matches(/^(?:\+213|00213|0)[5-7]\d{8}$/, {
    message: 'Numéro de mobile algérien attendu',
  })
  phone!: string;

  @IsString()
  @Length(2, 80)
  fullName!: string;

  @IsString()
  @Length(2, 80)
  salonName!: string;

  @IsString()
  @Length(4, 200)
  addressLine!: string;

  @IsString()
  @Length(2, 80)
  district!: string;

  @IsOptional()
  @IsIn(CITIES)
  city?: City;

  /** Numéro WhatsApp public du salon, distinct de celui du gérant. */
  @IsString()
  @Matches(/^(?:\+213|00213|0)[5-7]\d{8}$/, {
    message: 'Numéro de mobile algérien attendu',
  })
  contactPhone!: string;

  @IsOptional()
  @IsBoolean()
  isWomenOnly?: boolean;

  /**
   * Un salon créé par la plateforme est actif d'emblée : c'est un geste
   * commercial, la validation manuelle n'a plus d'objet.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export const REVIEW_VISIBILITY_FILTERS = [
  'all',
  'published',
  'hidden',
] as const;
export type ReviewVisibilityFilter = (typeof REVIEW_VISIBILITY_FILTERS)[number];

export class AdminReviewsQueryDto {
  @IsOptional()
  @IsIn(REVIEW_VISIBILITY_FILTERS)
  visibility?: ReviewVisibilityFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  maxRating?: number;
}

/**
 * Modération d'un avis.
 *
 * Volontairement un basculement de visibilité et non une suppression :
 * effacer la ligne ferait aussi disparaître la trace de la modération, et
 * rouvrirait la possibilité de redéposer un avis sur le même rendez-vous.
 */
export class ModerateReviewDto {
  @IsBoolean()
  isPublished!: boolean;
}
