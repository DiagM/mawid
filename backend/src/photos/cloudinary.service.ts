import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

/**
 * ============================================
 * Cloudinary — hébergement des photos
 * ============================================
 * Seule dépendance externe du produit, et elle est volontairement cantonnée
 * à ce fichier : rien d'autre ne connaît Cloudinary. En changer un jour
 * revient à réécrire cette classe, comme pour `PaymentProvider`.
 *
 * **Téléversement direct depuis le navigateur.** Le fichier ne transite pas
 * par le backend : celui-ci se contente de signer la demande. Deux raisons —
 * l'hébergement gratuit visé a peu de mémoire et n'a pas à tamponner des
 * images, et l'API secret ne quitte jamais le serveur.
 *
 * ⚠️ Conséquence : ce que le navigateur renvoie après l'envoi n'est **pas**
 * digne de confiance. On ne stocke jamais une URL fournie par le client ; on
 * interroge Cloudinary pour obtenir l'URL canonique (voir `fetchResource`).
 */

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export interface RemoteImage {
  publicId: string;
  secureUrl: string;
  bytes: number;
  format: string;
}

@Injectable()
export class CloudinaryService {
  private readonly cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';
  private readonly apiKey = process.env.CLOUDINARY_API_KEY ?? '';
  private readonly apiSecret = process.env.CLOUDINARY_API_SECRET ?? '';

  /**
   * Le produit doit rester utilisable sans Cloudinary : une fiche salon
   * s'affiche très bien sans photo. On ne fait donc pas échouer le démarrage,
   * on désactive la fonctionnalité.
   */
  get isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /** Dossier d'un salon. Sert aussi de périmètre de sécurité. */
  folderFor(salonId: string): string {
    return `mawid/salons/${salonId}`;
  }

  /**
   * Signature d'un téléversement, valable pour le seul dossier du salon.
   *
   * La signature porte sur `folder` : un gérant ne peut donc pas déposer
   * dans le dossier d'un autre salon, même en modifiant la requête envoyée
   * à Cloudinary depuis son navigateur.
   */
  signUpload(salonId: string): UploadSignature {
    this.assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = this.folderFor(salonId);

    // Cloudinary signe la concaténation des paramètres triés par nom, suivie
    // de l'API secret. L'ordre n'est pas négociable.
    const payload = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1')
      .update(`${payload}${this.apiSecret}`)
      .digest('hex');

    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      folder,
      signature,
    };
  }

  /**
   * Relit une image auprès de Cloudinary.
   *
   * C'est ce qui rend le dispositif sûr : on ne croit pas le navigateur sur
   * l'URL déposée, on demande à Cloudinary ce qu'il détient réellement sous
   * cet identifiant. Une image inexistante, ou déposée ailleurs que dans le
   * dossier du salon, est rejetée ici.
   */
  async fetchResource(publicId: string): Promise<RemoteImage | null> {
    this.assertConfigured();

    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString(
      'base64',
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Service de photos indisponible. Réessayez dans un instant.',
      );
    }

    const body = (await response.json()) as {
      public_id: string;
      secure_url: string;
      bytes: number;
      format: string;
    };

    return {
      publicId: body.public_id,
      secureUrl: body.secure_url,
      bytes: body.bytes,
      format: body.format,
    };
  }

  /** Supprime définitivement une image. */
  async destroy(publicId: string): Promise<void> {
    this.assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`)
      .digest('hex');

    const form = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: this.apiKey,
      signature,
    });

    await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
      { method: 'POST', body: form },
    );
  }

  /**
   * Identifiant Cloudinary d'une URL que NOUS avons produite.
   *
   * Ne fonctionne que sur nos propres URL, dont la forme est connue :
   * `.../image/upload/v<version>/<public_id>.<extension>`. C'est suffisant —
   * `Salon.photos` ne contient que des URL renvoyées par `fetchResource`.
   */
  publicIdFromUrl(url: string): string | null {
    const match = /\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);

    return match ? match[1] : null;
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'L’envoi de photos n’est pas configuré sur cette installation.',
      );
    }
  }
}
