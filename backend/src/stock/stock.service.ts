import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { utcToLocalDate } from '../common/time/algiers-time';
import type {
  CreateProductDto,
  CreateStockMovementDto,
  UpdateProductDto,
} from './dto/stock.dto';

/**
 * ============================================
 * Stocks (V4)
 * ============================================
 * Shampoings, teintures, consommables.
 *
 * La quantité est **dénormalisée** sur le produit : elle est lue en
 * permanence (liste, alertes de seuil) alors que les mouvements ne servent
 * qu'à l'historique. Recalculer une somme de mouvements à chaque affichage
 * serait coûteux pour rien. En contrepartie, elle n'est jamais écrite seule :
 * toujours dans la même transaction que le mouvement qui la justifie.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const salon = await this.getOwnedSalon(userId);

    const products = await this.prisma.product.findMany({
      where: { salonId: salon.id },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      costCents: product.costCents,
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold,
      isActive: product.isActive,
      // Calculé ici plutôt que côté interface : c'est une règle métier, et
      // elle doit être la même pour toutes les vues.
      isLowStock:
        product.isActive && product.quantity <= product.lowStockThreshold,
    }));
  }

  async create(userId: string, dto: CreateProductDto) {
    const salon = await this.getOwnedSalon(userId);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          salonId: salon.id,
          name: dto.name,
          unit: dto.unit,
          costCents: dto.costCents,
          quantity: dto.quantity ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 0,
        },
      });

      // Le stock initial est un mouvement comme un autre : sans cette ligne,
      // l'historique commencerait par un trou inexpliqué.
      if (product.quantity !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            delta: product.quantity,
            reason: 'Stock initial',
            occurredAt: new Date(),
          },
        });
      }

      return product;
    });
  }

  async update(userId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.assertOwnership(userId, productId);

    // La quantité n'est volontairement PAS modifiable ici : elle ne change
    // que par un mouvement, qui en porte la raison et la date. La laisser
    // éditable en direct rendrait l'historique faux sans prévenir.
    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.costCents !== undefined && { costCents: dto.costCents }),
        ...(dto.lowStockThreshold !== undefined && {
          lowStockThreshold: dto.lowStockThreshold,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * Entrée ou sortie de stock.
   *
   * Le mouvement et la nouvelle quantité sont écrits dans la même
   * transaction : un mouvement enregistré sans mise à jour de la quantité
   * (ou l'inverse) laisserait le stock affiché et son historique en
   * désaccord, sans moyen de savoir lequel a raison.
   */
  async move(userId: string, productId: string, dto: CreateStockMovementDto) {
    const product = await this.assertOwnership(userId, productId);

    if (dto.delta === 0) {
      throw new BadRequestException('Le mouvement doit être non nul');
    }

    const current = await this.prisma.product.findUnique({
      where: { id: product.id },
      select: { quantity: true },
    });

    const nextQuantity = (current?.quantity ?? 0) + dto.delta;

    if (nextQuantity < 0) {
      // Un stock négatif n'existe pas physiquement : c'est une erreur de
      // saisie, et l'accepter masquerait le vrai problème.
      throw new BadRequestException(
        'Ce mouvement rendrait le stock négatif. Vérifiez la quantité.',
      );
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Date invalide');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          delta: dto.delta,
          reason: dto.reason,
          occurredAt,
        },
      });

      return tx.product.update({
        where: { id: product.id },
        data: { quantity: nextQuantity },
        select: { id: true, name: true, quantity: true },
      });
    });
  }

  /** Historique d'un produit. */
  async movements(userId: string, productId: string, limit = 50) {
    const product = await this.assertOwnership(userId, productId);

    const movements = await this.prisma.stockMovement.findMany({
      where: { productId: product.id },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: { id: true, delta: true, reason: true, occurredAt: true },
    });

    return movements.map((movement) => ({
      id: movement.id,
      delta: movement.delta,
      reason: movement.reason,
      localDate: utcToLocalDate(movement.occurredAt),
    }));
  }

  // ============================================
  // Helpers privés
  // ============================================

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

  private async assertOwnership(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, salon: { select: { ownerId: true } } },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    if (product.salon.ownerId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce produit");
    }

    return product;
  }
}
