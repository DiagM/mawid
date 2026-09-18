import {
  IsBoolean,
  IsEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/**
 * Inscription self-service d'un gérant (business plan §7.1).
 *
 * Le salon créé arrive avec `isActive = false` : il n'apparaît dans aucune
 * recherche et sa fiche publique renvoie un 404 tant que le fondateur ne l'a
 * pas validé. Le gérant peut en revanche se connecter immédiatement pour
 * préparer ses prestations et ses horaires (docs/MVP_SCOPE.md §3.4).
 *
 * Aucun champ sensible n'est accepté ici : ni `isActive`, ni `plan`, ni
 * `role`, ni `slug`. Les laisser passer permettrait à n'importe qui de
 * s'auto-valider, de s'offrir un plan payant ou de devenir administrateur.
 */
export class RegisterDto {
  // ---- Compte gérant ----

  @IsString()
  @Matches(/^(?:\+213|00213|0)[5-7]\d{8}$/, {
    message: 'Numéro de mobile algérien attendu',
  })
  phone!: string;

  @IsString()
  @Length(2, 80)
  fullName!: string;

  /**
   * Même exigence que le changement de mot de passe : ce secret protège
   * l'agenda complet d'un salon et les numéros de tous ses clients.
   */
  @IsString()
  @Length(10, 128)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre',
  })
  password!: string;

  // ---- Salon ----

  @IsString()
  @Length(2, 80)
  salonName!: string;

  @IsString()
  @Length(4, 200)
  addressLine!: string;

  @IsString()
  @Length(2, 80)
  district!: string;

  /** Numéro WhatsApp public, distinct du numéro de connexion du gérant. */
  @IsString()
  @Matches(/^(?:\+213|00213|0)[5-7]\d{8}$/, {
    message: 'Numéro de mobile algérien attendu',
  })
  contactPhone!: string;

  @IsOptional()
  @IsBoolean()
  isWomenOnly?: boolean;

  /**
   * Piège à robots : doit rester vide. Même dispositif que sur la réservation
   * publique (docs/SECURITY.md §1.1) — l'inscription est l'autre surface
   * d'écriture ouverte sans authentification.
   */
  @IsOptional()
  @IsEmpty({ message: 'Requête invalide' })
  website?: string;
}
