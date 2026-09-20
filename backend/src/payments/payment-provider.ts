/**
 * ============================================
 * Abstraction de paiement (V4)
 * ============================================
 * Le prépaiement SATIM est **écarté** par la contrainte de gratuité : il
 * suppose un contrat bancaire et 2 % de frais par transaction
 * (docs/MVP_SCOPE.md §2.1).
 *
 * Cette interface n'existe donc pas pour faire fonctionner un paiement en
 * ligne aujourd'hui, mais pour que l'ajouter plus tard reste un **ajout** et
 * non une refonte : le jour où SATIM devient acceptable, on écrit une
 * seconde implémentation et on change une variable d'environnement. Aucune
 * route, aucun service métier n'aura à bouger.
 *
 * C'est la règle d'architecture posée dans `docs/MVP_SCOPE.md` §2.1 : chaque
 * substitut au gratuit vit derrière une frontière explicite.
 *
 * ⚠️ Ne pas étoffer cette interface par anticipation. Elle décrit ce dont le
 * produit a besoin aujourd'hui — savoir si un acompte est dû et comment il a
 * été réglé. Y ajouter des notions empruntées à une passerelle particulière
 * (jeton 3-D Secure, URL de retour, webhook) la rendrait déjà spécifique à
 * SATIM, ce qui est exactement ce qu'elle cherche à éviter.
 */

/** Ce que le client doit régler, et comment. */
export interface DepositRequest {
  reservationId: string;
  amountCents: number;
  /** Prénom du client, pour les libellés du fournisseur. */
  clientFirstName: string;
}

export type DepositStatus =
  /** Rien à régler en ligne : le client paie sur place. */
  | 'NOT_REQUIRED'
  /** En attente de règlement par le client. */
  | 'PENDING'
  /** Réglé. */
  | 'SETTLED';

export interface DepositResult {
  status: DepositStatus;
  /**
   * Où envoyer le client pour régler, quand le fournisseur en a besoin.
   * `null` pour un règlement sur place : il n'y a nulle part où aller.
   */
  redirectUrl: string | null;
  /** Message affichable, déjà en français. */
  message: string;
}

/**
 * Contrat que toute passerelle devra remplir.
 *
 * Volontairement minimal : trois opérations, pas une de plus. Une interface
 * qui anticipe les besoins d'un fournisseur qu'on n'a pas encore intégré
 * finit toujours par lui ressembler.
 */
export interface PaymentProvider {
  /** Identifiant court, pour les journaux et la configuration. */
  readonly name: string;

  /** Un acompte en ligne est-il exigé pour cette réservation ? */
  requiresDeposit(request: DepositRequest): boolean;

  /** Démarre le règlement, ou constate qu'il n'y a rien à régler. */
  initiateDeposit(request: DepositRequest): Promise<DepositResult>;

  /** État actuel du règlement d'une réservation. */
  getStatus(reservationId: string): Promise<DepositStatus>;
}
