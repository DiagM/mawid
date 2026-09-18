import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SearchSalonsDto } from './dto/search-salons.dto';

@Injectable()
export class SalonsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche publique de salons.
   *
   * Ne renvoie que des salons actifs : un salon désactivé, ou créé par
   * onboarding self-service et pas encore validé, ne doit apparaître nulle
   * part (docs/MVP_SCOPE.md §3.4).
   *
   * Le `select` est explicite et volontairement réduit : cette route est
   * publique, elle ne doit jamais laisser filtrer `ownerId` ni quoi que ce
   * soit d'interne (docs/SECURITY.md §3).
   */
  async search(dto: SearchSalonsDto) {
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const query = dto.q?.trim();

    const where: Prisma.SalonWhereInput = {
      isActive: true,
      ...(dto.city && { city: dto.city }),
      ...(dto.womenOnly && { isWomenOnly: true }),
      ...(query && {
        // On cherche aussi dans les prestations : un client tape « barbe »
        // bien plus souvent que le nom d'un salon qu'il ne connaît pas encore.
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { district: { contains: query, mode: 'insensitive' } },
          {
            prestations: {
              some: {
                isActive: true,
                name: { contains: query, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    const [salons, total] = await Promise.all([
      this.prisma.salon.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        take: limit,
        skip: offset,
        select: {
          slug: true,
          name: true,
          district: true,
          city: true,
          isWomenOnly: true,
          photos: true,
          prestations: {
            where: { isActive: true },
            orderBy: { priceCents: 'asc' },
            take: 1,
            select: { priceCents: true },
          },
        },
      }),
      this.prisma.salon.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      items: salons.map((salon) => ({
        slug: salon.slug,
        name: salon.name,
        district: salon.district,
        city: salon.city,
        isWomenOnly: salon.isWomenOnly,
        photo: salon.photos[0] ?? null,
        // « À partir de » : le prix d'appel est ce qui fait cliquer, et il
        // évite d'afficher un catalogue complet dans une liste de résultats.
        fromPriceCents: salon.prestations[0]?.priceCents ?? null,
      })),
    };
  }

  /**
   * Liste des slugs actifs, pour le sitemap.
   * Requête volontairement minimale : elle peut être appelée à chaque
   * génération de sitemap.
   */
  findActiveSlugs() {
    return this.prisma.salon.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

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
        // Numéro WhatsApp public : c'est lui qui porte tout le parcours de
        // confirmation côté client (lien wa.me) et les données structurées
        // de la fiche. Sans lui, la stratégie de notification tombe.
        contactPhone: true,
        isWomenOnly: true,
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
