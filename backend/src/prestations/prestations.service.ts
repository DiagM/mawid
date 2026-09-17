import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrestationDto } from './dto/create-prestation.dto';
import { UpdatePrestationDto } from './dto/update-prestation.dto';

@Injectable()
export class PrestationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les prestations actives d'un salon par son slug.
   * Route publique (page salon).
   */
  async findPublicBySalonSlug(slug: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon introuvable');
    }

    return this.prisma.prestation.findMany({
      where: { salonId: salon.id, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceCents: true,
      },
    });
  }

  /**
   * Récupère toutes les prestations du salon du gérant connecté
   * (actives ET archivées, pour gestion).
   */
  async findMine(userId: string) {
    const salon = await this.getOwnedSalon(userId);

    return this.prisma.prestation.findMany({
      where: { salonId: salon.id },
      orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }],
    });
  }

  /**
   * Crée une prestation pour le salon du gérant connecté.
   */
  async create(userId: string, dto: CreatePrestationDto) {
    const salon = await this.getOwnedSalon(userId);

    return this.prisma.prestation.create({
      data: {
        salonId: salon.id,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        priceCents: dto.priceCents,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  /**
   * Met à jour une prestation.
   * Vérifie que la prestation appartient bien au salon du gérant.
   */
  async update(userId: string, prestationId: string, dto: UpdatePrestationDto) {
    await this.assertOwnership(userId, prestationId);

    return this.prisma.prestation.update({
      where: { id: prestationId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.durationMinutes !== undefined && {
          durationMinutes: dto.durationMinutes,
        }),
        ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * Archive une prestation (soft delete : isActive = false).
   * On ne supprime PAS en dur pour préserver l'historique des réservations.
   */
  async archive(userId: string, prestationId: string) {
    await this.assertOwnership(userId, prestationId);

    return this.prisma.prestation.update({
      where: { id: prestationId },
      data: { isActive: false },
    });
  }

  // ============================================
  // Helpers privés
  // ============================================

  /**
   * Récupère le salon du gérant connecté ou lève une exception.
   */
  private async getOwnedSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    return salon;
  }

  /**
   * Vérifie que la prestation appartient bien au salon du gérant connecté.
   * Lève NotFound si la prestation n'existe pas, Forbidden si elle existe
   * mais appartient à un autre salon.
   */
  private async assertOwnership(userId: string, prestationId: string) {
    const prestation = await this.prisma.prestation.findUnique({
      where: { id: prestationId },
      select: { salon: { select: { ownerId: true } } },
    });

    if (!prestation) {
      throw new NotFoundException('Prestation introuvable');
    }

    if (prestation.salon.ownerId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette prestation");
    }
  }
}
