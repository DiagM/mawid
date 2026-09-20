import { Injectable } from '@nestjs/common';
import type {
  DepositRequest,
  DepositResult,
  DepositStatus,
  PaymentProvider,
} from './payment-provider';

/**
 * Paiement sur place : la seule implementation de la V4.
 *
 * Elle ne fait rien, et c'est le but. Le client regle au salon, comme
 * aujourd'hui. Son interet n'est pas fonctionnel mais structurel : le code
 * metier appelle deja un PaymentProvider, donc le jour ou SATIM devient
 * acceptable, il n'y a qu'une seconde implementation a ecrire.
 *
 * Aucun acompte n'est jamais exige : imposer un prepaiement sans passerelle
 * bloquerait des reservations sans moyen de les encaisser.
 */
@Injectable()
export class OnSitePaymentProvider implements PaymentProvider {
  readonly name = 'on-site';

  requiresDeposit(_request: DepositRequest): boolean {
    return false;
  }

  initiateDeposit(_request: DepositRequest): Promise<DepositResult> {
    return Promise.resolve({
      status: 'NOT_REQUIRED',
      // Pas de redirection : il n'y a nulle part ou aller, le client paie
      // au salon.
      redirectUrl: null,
      message: 'Le règlement se fait directement au salon.',
    });
  }

  getStatus(_reservationId: string): Promise<DepositStatus> {
    return Promise.resolve('NOT_REQUIRED');
  }
}
