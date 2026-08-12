import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalonAdminDto } from './dto/create-salon-admin.dto';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Statistiques globales de la plateforme, pour le tableau de bord admin.
   */
  async getDashboard() {
    const now = new Date();
    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [
      totalSalons,
      activeSalons,
      totalReservations,
      reservationsThisMonth,
    ] = await Promise.all([
      this.prisma.salon.count(),
      this.prisma.salon.count({ where: { isActive: true } }),
      this.prisma.reservation.count(),
      this.prisma.reservation.count({
        where: { createdAt: { gte: startOfMonthUtc } },
      }),
    ]);

    return {
      totalSalons,
      activeSalons,
      totalReservations,
      reservationsThisMonth,
      // MRR (revenu récurrent mensuel) : la facturation des salons n'est pas
      // encore implémentée (pas d'intégration paiement en V1/V2). À calculer
      // réellement quand la facturation sera mise en place (V3).
      mrr: 0,
    };
  }

  /**
   * Crée un salon + son compte gérant en une seule transaction.
   * Utilisé par l'admin pour onboarder un nouveau salon (pas d'inscription
   * self-service côté gérant en V1).
   */
  async createSalon(dto: CreateSalonAdminDto) {
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.ownerPhone },
    });
    if (existingPhone) {
      throw new ConflictException(
        'Un compte existe déjà avec ce numéro de téléphone',
      );
    }

    const existingSlug = await this.prisma.salon.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(
        'Ce slug est déjà utilisé par un autre salon',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.ownerPassword,
      BCRYPT_SALT_ROUNDS,
    );

    const salon = await this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          phone: dto.ownerPhone,
          passwordHash,
          fullName: dto.ownerFullName,
          role: 'MANAGER',
        },
      });

      return tx.salon.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          addressLine: dto.addressLine,
          district: dto.district,
          city: dto.city ?? 'Alger',
          openingHours: dto.openingHours as unknown as Prisma.InputJsonValue,
          photos: dto.photos ?? [],
          ownerId: owner.id,
        },
        include: { owner: { select: { phone: true } } },
      });
    });

    const { owner, ...salonFields } = salon;

    return {
      ...salonFields,
      ownerPhone: owner.phone,
    };
  }
}
