import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';

/**
 * Photos par salon.
 *
 * Six suffit à présenter un salon, et le plafond protège autant la page —
 * une galerie de quarante images ne se regarde pas — que le quota de
 * l'hébergeur.
 */
const MAX_PHOTOS = 6;

/** 10 Mo. Au-delà, c'est une photo non redimensionnée sortie d'un appareil. */
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Autorisation d'envoi, limitée au dossier du salon du gérant connecté. */
  async signUpload(userId: string) {
    const salon = await this.getOwnedSalon(userId);

    if (salon.photos.length >= MAX_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${MAX_PHOTOS} photos. Supprimez-en une avant d'en ajouter.`,
      );
    }

    return this.cloudinary.signUpload(salon.id);
  }

  /**
   * Enregistre une photo tout juste déposée.
   *
   * Le navigateur n'envoie que l'identifiant : **l'URL est relue auprès de
   * Cloudinary**, jamais acceptée telle quelle. Sans cela, un gérant pourrait
   * faire pointer sa fiche vers n'importe quelle image du web, y compris
   * celle d'un concurrent ou pire.
   */
  async confirm(userId: string, publicId: string) {
    const salon = await this.getOwnedSalon(userId);

    if (salon.photos.length >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS} photos.`);
    }

    // Le dossier est signé côté Cloudinary, mais on revérifie : la défense
    // qui saute est toujours celle qu'on croyait inutile.
    const folder = this.cloudinary.folderFor(salon.id);
    if (!publicId.startsWith(`${folder}/`)) {
      throw new BadRequestException('Photo invalide');
    }

    const image = await this.cloudinary.fetchResource(publicId);
    if (!image) {
      throw new NotFoundException('Photo introuvable');
    }

    if (!ALLOWED_FORMATS.includes(image.format.toLowerCase())) {
      await this.cloudinary.destroy(publicId);
      throw new BadRequestException('Format d’image non accepté');
    }

    if (image.bytes > MAX_BYTES) {
      // On supprime plutôt que de laisser traîner un fichier refusé : il
      // consommerait le quota sans jamais servir.
      await this.cloudinary.destroy(publicId);
      throw new BadRequestException('Photo trop lourde (10 Mo maximum)');
    }

    // Un double clic sur « Ajouter », ou une requête rejouée, ne doit pas
    // faire apparaître deux fois la même image : la suppression les
    // retirerait alors toutes les deux d'un coup, ce qui surprendrait.
    if (salon.photos.includes(image.secureUrl)) {
      return { photos: salon.photos };
    }

    const updated = await this.prisma.salon.update({
      where: { id: salon.id },
      data: { photos: { push: image.secureUrl } },
      select: { photos: true },
    });

    return { photos: updated.photos };
  }

  /** Retire une photo de la fiche et du stockage. */
  async remove(userId: string, url: string) {
    const salon = await this.getOwnedSalon(userId);

    if (!salon.photos.includes(url)) {
      throw new NotFoundException('Photo introuvable');
    }

    const updated = await this.prisma.salon.update({
      where: { id: salon.id },
      data: { photos: salon.photos.filter((photo) => photo !== url) },
      select: { photos: true },
    });

    // La fiche est à jour quoi qu'il arrive ensuite : un échec de suppression
    // chez l'hébergeur ne doit pas empêcher le gérant de retirer une photo de
    // sa page. Au pire, un fichier orphelin subsiste.
    const publicId = this.cloudinary.publicIdFromUrl(url);
    if (publicId) {
      await this.cloudinary.destroy(publicId).catch(() => undefined);
    }

    return { photos: updated.photos };
  }

  /**
   * Réordonne la galerie.
   *
   * La première photo est celle qui apparaît dans les résultats de
   * recherche : pouvoir la choisir compte plus que d'en ajouter une de plus.
   */
  async reorder(userId: string, photos: string[]) {
    const salon = await this.getOwnedSalon(userId);

    const sameSet =
      photos.length === salon.photos.length &&
      photos.every((photo) => salon.photos.includes(photo));

    if (!sameSet) {
      // Accepter une liste arbitraire permettrait d'injecter une URL
      // étrangère par la porte de derrière.
      throw new BadRequestException('Liste de photos invalide');
    }

    const updated = await this.prisma.salon.update({
      where: { id: salon.id },
      data: { photos },
      select: { photos: true },
    });

    return { photos: updated.photos };
  }

  private async getOwnedSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true, photos: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    return salon;
  }
}
