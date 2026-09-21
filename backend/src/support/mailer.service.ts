import { Injectable, Logger } from '@nestjs/common';

/**
 * ============================================
 * Envoi d'e-mail — Resend
 * ============================================
 * Cantonné à ce fichier, comme Cloudinary : rien d'autre ne connaît Resend.
 *
 * ⚠️ **Un échec d'envoi ne doit jamais faire échouer une demande.** Le ticket
 * est la source de vérité ; l'e-mail n'est qu'une notification. Un gérant qui
 * verrait « une erreur est survenue » alors que sa demande est bien
 * enregistrée réécrirait, et le fondateur recevrait deux fois la même chose.
 *
 * Sans configuration, l'envoi est simplement désactivé — la page contact
 * continue de fonctionner et les demandes s'accumulent dans la console.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  private readonly apiKey = readEnv('RESEND_API_KEY');
  private readonly to = readEnv('MAWID_CONTACT_EMAIL');

  /**
   * Expéditeur. `onboarding@resend.dev` fonctionne sans vérifier de domaine,
   * ce qui permet de démarrer tout de suite ; à remplacer par une adresse du
   * domaine Mawid une fois celui-ci vérifié, faute de quoi les messages
   * finiront en indésirables.
   */
  private readonly from =
    readEnv('MAWID_MAIL_FROM') || 'Mawid <onboarding@resend.dev>';

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.to);
  }

  /**
   * Notifie le fondateur qu'une demande est arrivée.
   *
   * Ne lève jamais : l'appelant n'a pas à décider quoi faire d'un e-mail
   * perdu.
   */
  async notify(subject: string, lines: string[]): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [this.to],
          subject,
          // Texte brut : un e-mail interne n'a pas besoin de mise en forme,
          // et le texte passe mieux les filtres anti-spam.
          text: lines.join('\n'),
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Envoi e-mail refusé par Resend (${response.status}). La demande est enregistrée.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Envoi e-mail impossible : ${error instanceof Error ? error.message : 'erreur inconnue'}. La demande est enregistrée.`,
      );
    }
  }
}

/**
 * Variable d'environnement, une valeur vide comptant pour absente.
 *
 * `process.env.X ?? 'defaut'` ne rattrape PAS une chaîne vide : une variable
 * déclarée sans valeur — ce que produit un fichier `.env` recopié depuis un
 * exemple, ou un champ laissé vide dans un tableau de bord — écraserait le
 * repli. Ici cela aurait donné un expéditeur vide, donc chaque envoi refusé
 * par Resend, et pour seul signal un avertissement dans les journaux.
 */
function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}
