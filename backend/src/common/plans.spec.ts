import { buildQuotaStatus, MONTHLY_RESERVATION_QUOTA } from './plans';

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
