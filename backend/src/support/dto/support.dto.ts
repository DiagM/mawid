import {
  IsEmail,
  IsEmpty,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export const TICKET_KINDS = ['UPGRADE', 'ISSUE', 'OTHER'] as const;
export type TicketKindValue = (typeof TICKET_KINDS)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

export const REQUESTABLE_PLANS = ['PRO', 'PRO_PLUS'] as const;

/**
 * Demande adressée à Mawid.
 *
 * Aucun `salonId` ni `userId` : quand l'auteur est connecté, les deux sont
 * déduits du JWT. Les accepter ici permettrait d'écrire au nom d'un autre
 * salon (CLAUDE.md §3.2).
 */
export class CreateTicketDto {
  @IsIn(TICKET_KINDS)
  kind!: TicketKindValue;

  @IsString()
  @Length(3, 120)
  subject!: string;

  @IsString()
  @Length(10, 2000)
  message!: string;

  @IsString()
  @Length(2, 80)
  contactName!: string;

  /**
   * Mobile algérien. C'est le canal de rappel réel : l'e-mail est optionnel
   * parce que beaucoup de gérants n'en consultent aucun.
   */
  @IsString()
  @Matches(/^(?:\+213|00213|0)[5-7]\d{8}$/, {
    message: 'Numéro de mobile algérien attendu',
  })
  contactPhone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @Length(5, 160)
  contactEmail?: string;

  /** Offre visée par une demande de changement. Ignorée pour les autres. */
  @IsOptional()
  @IsIn(REQUESTABLE_PLANS)
  requestedPlan?: (typeof REQUESTABLE_PLANS)[number];

  /**
   * Piège à robots (docs/SECURITY.md §1.1). La page contact est ouverte sans
   * authentification : c'est la troisième surface d'écriture publique du
   * produit, après la réservation et l'inscription.
   */
  @IsOptional()
  @IsEmpty({ message: 'Requête invalide' })
  website?: string;
}

export class TicketsQueryDto {
  @IsOptional()
  @IsIn([...TICKET_STATUSES, 'ALL'])
  status?: TicketStatusValue | 'ALL';
}

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatusValue;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  internalNote?: string;
}
