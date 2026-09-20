import {
  assertCapability,
  assertEmployeeQuota,
  buildQuotaStatus,
  capabilitiesFor,
  MONTHLY_RESERVATION_QUOTA,
} from './plans';
import { ForbiddenException } from '@nestjs/common';

const RESET = new Date('2026-10-01T00:00:00.000Z');

describe('quotas par offre', () => {
  it('limite le plan Free a 30 reservations par mois', () => {
    expect(MONTHLY_RESERVATION_QUOTA.FREE).toBe(30);
  });

  it('laisse Pro et Pro+ illimites', () => {
    expect(MONTHLY_RESERVATION_QUOTA.PRO).toBeNull();
    expect(MONTHLY_RESERVATION_QUOTA.PRO_PLUS).toBeNull();
  });

  it('ne bloque jamais un plan illimite', () => {
    const status = buildQuotaStatus('PRO', 5000, RESET);

    expect(status.isExceeded).toBe(false);
    expect(status.isNearLimit).toBe(false);
    expect(status.remaining).toBeNull();
  });

  it('alerte le gerant avant le blocage, pas apres', () => {
    // A 24 RDV sur 30, il reste generalement une semaine pour reagir.
    const warning = buildQuotaStatus('FREE', 24, RESET);

    expect(warning.isNearLimit).toBe(true);
    // Le point cle : on alerte SANS bloquer, il peut encore recevoir des
    // clients pendant qu'il decide de passer au plan Pro.
    expect(warning.isExceeded).toBe(false);
    expect(warning.remaining).toBe(6);
  });

  it('ne bloque qu une fois la limite atteinte', () => {
    expect(buildQuotaStatus('FREE', 29, RESET).isExceeded).toBe(false);
    expect(buildQuotaStatus('FREE', 30, RESET).isExceeded).toBe(true);
  });

  it('ne renvoie jamais un reste negatif', () => {
    // Le quota peut etre depasse si l'offre change en cours de mois.
    const status = buildQuotaStatus('FREE', 42, RESET);

    expect(status.remaining).toBe(0);
    expect(status.isExceeded).toBe(true);
  });
});

describe('capacités par offre', () => {
  it('ne verrouille aucun module au-delà du quota en Gratuit', () => {
    // Le quota mensuel est la SEULE exception du produit qui dégrade
    // l'expérience de la cliente. Aucun autre verrou ne doit s'y ajouter :
    // un salon Gratuit reste entièrement réservable, notable, consultable.
    const free = capabilitiesFor('FREE');

    expect(free.monthlyReservations).toBe(30);
    expect(free.maxEmployees).toBe(1);
  });

  it('ouvre la clientèle en Pro, la caisse et les stocks en Pro+', () => {
    expect(capabilitiesFor('PRO').clients).toBe(true);
    expect(capabilitiesFor('PRO').cash).toBe(false);
    expect(capabilitiesFor('PRO_PLUS').cash).toBe(true);
    expect(capabilitiesFor('PRO_PLUS').stock).toBe(true);
  });

  it('ne plafonne plus rien dès l’offre Pro', () => {
    for (const plan of ['PRO', 'PRO_PLUS'] as const) {
      expect(capabilitiesFor(plan).monthlyReservations).toBeNull();
      expect(capabilitiesFor(plan).maxEmployees).toBeNull();
      expect(capabilitiesFor(plan).statsMonths).toBeNull();
    }
  });
});

describe('assertCapability', () => {
  it('laisse passer un module compris dans l’offre', () => {
    expect(() => assertCapability('PRO_PLUS', 'cash')).not.toThrow();
    expect(() => assertCapability('PRO', 'clients')).not.toThrow();
  });

  it('refuse un module hors offre', () => {
    expect(() => assertCapability('FREE', 'clients')).toThrow(
      ForbiddenException,
    );
    expect(() => assertCapability('PRO', 'cash')).toThrow(ForbiddenException);
  });

  it('nomme l’offre requise dans le message', () => {
    // Un refus muet ressemble à une panne et ne vend rien.
    expect(() => assertCapability('FREE', 'clients')).toThrow(/offre Pro\b/);
    expect(() => assertCapability('FREE', 'cash')).toThrow(/offre Pro\+/);
    expect(() => assertCapability('PRO', 'stock')).toThrow(/offre Pro\+/);
  });
});

describe('assertEmployeeQuota', () => {
  it('autorise le premier membre en Gratuit', () => {
    expect(() => assertEmployeeQuota('FREE', 0)).not.toThrow();
  });

  it('refuse le second', () => {
    expect(() => assertEmployeeQuota('FREE', 1)).toThrow(ForbiddenException);
    expect(() => assertEmployeeQuota('FREE', 1)).toThrow(/une seule personne/i);
  });

  it('ne plafonne rien en Pro et Pro+', () => {
    expect(() => assertEmployeeQuota('PRO', 50)).not.toThrow();
    expect(() => assertEmployeeQuota('PRO_PLUS', 50)).not.toThrow();
  });
});
