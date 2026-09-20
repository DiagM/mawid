import { OnSitePaymentProvider } from './on-site-payment.provider';
import type { PaymentProvider } from './payment-provider';

const REQUEST = {
  reservationId: 'res-1',
  amountCents: 120000,
  clientFirstName: 'Amine',
};

describe('OnSitePaymentProvider', () => {
  // Typé par l'INTERFACE et non par la classe concrète. L'implémentation
  // actuelle n'a besoin d'aucun argument et n'en déclare donc aucun ; la
  // tester telle quelle vérifierait ce raccourci plutôt que le contrat que
  // SATIM devra remplir un jour.
  const provider: PaymentProvider = new OnSitePaymentProvider();

  it("n'exige jamais d'acompte en ligne", async () => {
    // Imposer un prepaiement sans passerelle bloquerait des reservations
    // sans aucun moyen de les encaisser.
    expect(provider.requiresDeposit(REQUEST)).toBe(false);
    expect(await provider.getStatus('res-1')).toBe('NOT_REQUIRED');
  });

  it('ne renvoie aucune redirection', async () => {
    // Il n'y a nulle part ou aller : le client paie au salon.
    const result = await provider.initiateDeposit(REQUEST);

    expect(result.status).toBe('NOT_REQUIRED');
    expect(result.redirectUrl).toBeNull();
  });

  it('explique au client ou il paie, en francais', async () => {
    const result = await provider.initiateDeposit(REQUEST);

    expect(result.message).toContain('salon');
  });

  it('respecte le contrat PaymentProvider', () => {
    // Ce test existe pour que l'ajout d'une seconde implementation (SATIM)
    // parte d'une interface deja verifiee, et non d'une supposition.
    expect(provider.name).toBe('on-site');
    expect(typeof provider.requiresDeposit).toBe('function');
    expect(typeof provider.initiateDeposit).toBe('function');
    expect(typeof provider.getStatus).toBe('function');
  });
});
