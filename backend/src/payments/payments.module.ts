import { Module } from '@nestjs/common';
import { OnSitePaymentProvider } from './on-site-payment.provider';

/**
 * Jeton d'injection du fournisseur de paiement.
 *
 * Passer par un jeton plutot que par la classe concrete est ce qui rend le
 * remplacement possible : le code metier depend du contrat, jamais de
 * l'implementation.
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

@Module({
  providers: [
    OnSitePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      // Une seule implementation aujourd'hui. Le jour ou SATIM est branche,
      // cette fabrique choisit selon une variable d'environnement — et rien
      // d'autre ne bouge dans le produit.
      useExisting: OnSitePaymentProvider,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
