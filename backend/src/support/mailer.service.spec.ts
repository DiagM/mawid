import { MailerService } from './mailer.service';

/**
 * Ce service lit l'environnement à la construction : chaque scénario doit
 * donc positionner les variables AVANT d'instancier.
 */
function mailerWith(env: Record<string, string | undefined>): MailerService {
  const saved = { ...process.env };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const service = new MailerService();
  process.env = saved;

  return service;
}

/** Expéditeur retenu, champ privé lu par assertion explicite. */
function senderOf(service: MailerService): string {
  return (service as unknown as { from: string }).from;
}

describe('MailerService', () => {
  describe('activation', () => {
    it('est actif quand la clé et le destinataire sont là', () => {
      const service = mailerWith({
        RESEND_API_KEY: 're_test',
        MAWID_CONTACT_EMAIL: 'fondateur@example.com',
      });

      expect(service.isConfigured).toBe(true);
    });

    it('reste inactif sans destinataire', () => {
      // Une clé sans destinataire ne permet d'envoyer nulle part : mieux
      // vaut désactiver que tenter et échouer à chaque demande.
      const service = mailerWith({
        RESEND_API_KEY: 're_test',
        MAWID_CONTACT_EMAIL: undefined,
      });

      expect(service.isConfigured).toBe(false);
    });

    it('traite une valeur vide comme absente', () => {
      // Le cas qui coûte cher : un `.env` recopié depuis l'exemple, ou un
      // champ laissé vide dans un tableau de bord. `?? ` ne rattraperait pas
      // une chaîne vide et le service se croirait configuré.
      const service = mailerWith({
        RESEND_API_KEY: 're_test',
        MAWID_CONTACT_EMAIL: '   ',
      });

      expect(service.isConfigured).toBe(false);
    });
  });

  describe('expéditeur', () => {
    it('retombe sur l’adresse Resend partagée quand rien n’est configuré', () => {
      const service = mailerWith({ MAWID_MAIL_FROM: undefined });

      expect(senderOf(service)).toBe('Mawid <onboarding@resend.dev>');
    });

    it('retombe aussi quand la variable est vide', () => {
      // Un expéditeur vide ferait refuser CHAQUE envoi par Resend, sans
      // autre signal qu'un avertissement dans les journaux.
      const service = mailerWith({ MAWID_MAIL_FROM: '' });

      expect(senderOf(service)).toBe('Mawid <onboarding@resend.dev>');
    });

    it('respecte une adresse de domaine vérifié', () => {
      const service = mailerWith({
        MAWID_MAIL_FROM: 'Mawid <contact@mawid.dz>',
      });

      expect(senderOf(service)).toBe('Mawid <contact@mawid.dz>');
    });
  });

  describe('notification', () => {
    it('ne tente rien et ne lève pas quand l’envoi est désactivé', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const service = mailerWith({
        RESEND_API_KEY: undefined,
        MAWID_CONTACT_EMAIL: undefined,
      });

      await expect(service.notify('Sujet', ['corps'])).resolves.toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it('n’échoue jamais, même si le fournisseur refuse', async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('nope', { status: 422 }));

      const service = mailerWith({
        RESEND_API_KEY: 're_test',
        MAWID_CONTACT_EMAIL: 'fondateur@example.com',
      });

      // Le ticket est la source de vérité : un gérant qui verrait « une
      // erreur est survenue » alors que sa demande est enregistrée
      // réécrirait, et le fondateur recevrait deux fois la même chose.
      await expect(service.notify('Sujet', ['corps'])).resolves.toBeUndefined();

      fetchSpy.mockRestore();
    });

    it('n’échoue pas non plus quand le réseau tombe', async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const service = mailerWith({
        RESEND_API_KEY: 're_test',
        MAWID_CONTACT_EMAIL: 'fondateur@example.com',
      });

      await expect(service.notify('Sujet', ['corps'])).resolves.toBeUndefined();

      fetchSpy.mockRestore();
    });
  });
});
