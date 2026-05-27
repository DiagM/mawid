import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère un salon par son slug pour l'affichage public (fiche salon).
   * Inclut les prestations actives uniquement.
   * N'affiche pas le owner pour préserver la vie privée.
   */
  async findPublicBySlug(slug: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        addressLine: true,
        district: true,
        city: true,
        latitude: true,
        longitude: true,
        openingHours: true,
        photos: true,
        isActive: true,
        prestations: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
      },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon introuvable');
    }

    return salon;
  }

  /**
   * Récupère le salon du gérant connecté.
   * En V1 : un gérant = un salon.
   */
  async findMine(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
    });

    if (!salon) {
      throw new NotFoundException(
        "Aucun salon n'est associé à votre compte. Contactez l'administrateur.",
      );
    }

    return salon;
  }

  /**
   * Met à jour le salon du gérant connecté.
   * Le gérant ne peut modifier QUE son propre salon (filtré par ownerId).
   */
  async updateMine(userId: string, dto: UpdateSalonDto) {
    const salon = await this.findMine(userId);

    // On construit l'objet data en respectant le type strict Prisma.SalonUpdateInput.
    // Le champ openingHours est typé Json en Prisma → on cast l'instance de classe
    // (créée par class-transformer) en plain object accepté par Prisma.
    const data: Prisma.SalonUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.addressLine !== undefined && { addressLine: dto.addressLine }),
      ...(dto.district !== undefined && { district: dto.district }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(dto.openingHours !== undefined && {
        openingHours: dto.openingHours as unknown as Prisma.InputJsonValue,
      }),
      ...(dto.photos !== undefined && { photos: dto.photos }),
    };

    return this.prisma.salon.update({
      where: { id: salon.id },
      data,
    });
  }
}