import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

/** Résumé de notation d'un salon, tel qu'affiché publiquement. */
export interface RatingSummary {
  average: number | null;
  count: number;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dépose un avis pour une réservation, via son token.
   *
   * C'est ici que se joue la réponse au « potentiel d'abus » que le business
   * plan redoutait (§7.1) — et elle est structurelle, pas déclarative :
   *
   * 1. il faut détenir le `cancellationToken`, donné une seule fois au client
   *    au moment de sa réservation ;
   * 2. le rendez-vous doit avoir été qualifié `HONORED` par le gérant, donc
   *    le client est réellement venu ;
   * 3. `reservationId` est unique : un passage, un avis.
   *
   * Personne ne peut noter un salon où il n'est jamais allé, et un concurrent
   * ne peut pas déverser dix avis négatifs.
   */
  async createFromToken(token: string, dto: CreateReviewDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { cancellationToken: token },
      select: {
        id: true,
        salonId: true,
        clientId: true,
        employeeId: true,
        status: true,
        review: { select: { id: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (reservation.status !== 'HONORED') {
      // Message explicite : le client n'a rien fait de mal, son rendez-vous
      // n'est simplement pas encore qualifié par le salon.
      throw new BadRequestException(
        'Vous pourrez laisser un avis une fois votre rendez-vous passé et confirmé par le salon.',
      );
    }

    if (reservation.review) {
      throw new ConflictException(
        'Vous avez déjà laissé un avis pour ce rendez-vous',
      );
    }

    return this.prisma.review.create({
      data: {
        salonId: reservation.salonId,
        reservationId: reservation.id,
        clientId: reservation.clientId,
        // Qui a réalisé la prestation, pour les statistiques par membre.
        employeeId: reservation.employeeId,
        rating: dto.rating,
        comment: dto.comment,
      },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
  }

  /**
   * Avis publics d'un salon.
   *
   * Le prénom du client vient du snapshot de la réservation, pas de sa fiche :
   * corriger une fiche client ne doit pas réécrire la signature d'un avis
   * déjà publié.
   */
  async findPublicBySalonSlug(slug: string, limit = 20, offset = 0) {
    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException('Salon introuvable');
    }

    const [reviews, summary] = await Promise.all([
      this.prisma.review.findMany({
        where: { salonId: salon.id, isPublished: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reservation: { select: { clientFirstName: true } },
          employee: { select: { fullName: true } },
        },
      }),
      this.summaryForSalon(salon.id),
    ]);

    return {
      ...summary,
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        clientFirstName: review.reservation.clientFirstName,
        employeeName: review.employee?.fullName ?? null,
      })),
    };
  }

  /** Moyenne et nombre d'avis publiés d'un salon. */
  async summaryForSalon(salonId: string): Promise<RatingSummary> {
    const result = await this.prisma.review.aggregate({
      where: { salonId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      // Arrondi au dixième : afficher « 4,3 » est lisible, « 4,333… » non.
      average:
        result._avg.rating === null
          ? null
          : Math.round(result._avg.rating * 10) / 10,
      count: result._count._all,
    };
  }

  /**
   * Résumés de plusieurs salons en une requête.
   * Utilisé par la recherche : faire un agrégat par salon produirait N+1
   * requêtes pour une page de résultats.
   */
  async summariesForSalons(
    salonIds: string[],
  ): Promise<Map<string, RatingSummary>> {
    if (salonIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.review.groupBy({
      by: ['salonId'],
      where: { salonId: { in: salonIds }, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return new Map(
      rows.map((row) => [
        row.salonId,
        {
          average:
            row._avg.rating === null
              ? null
              : Math.round(row._avg.rating * 10) / 10,
          count: row._count._all,
        },
      ]),
    );
  }

  /**
   * Avis reçus par le salon du gérant connecté.
   *
   * Lecture seule, volontairement : le gérant ne peut ni supprimer ni masquer
   * un avis. Un salon capable de cacher ses mauvaises notes rendrait tout le
   * système sans valeur. Le retrait d'un avis abusif relève de la plateforme.
   */
  async findMine(userId: string, limit = 50) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    const [reviews, summary] = await Promise.all([
      this.prisma.review.findMany({
        where: { salonId: salon.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          isPublished: true,
          reservation: {
            select: { clientFirstName: true, startsAt: true },
          },
          employee: { select: { fullName: true } },
        },
      }),
      this.summaryForSalon(salon.id),
    ]);

    return {
      ...summary,
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        isPublished: review.isPublished,
        clientFirstName: review.reservation.clientFirstName,
        visitedAt: review.reservation.startsAt.toISOString(),
        employeeName: review.employee?.fullName ?? null,
      })),
    };
  }
}
