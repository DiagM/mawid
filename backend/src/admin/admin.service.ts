import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../common/slug';
import { DEFAULT_CITY } from '../common/cities';
import { toE164 } from '../common/phone';
import { DEFAULT_OPENING_HOURS } from '../common/default-opening-hours';
import { generatePassword } from '../common/password';
import { buildQuotaStatus } from '../common/plans';
import { currentLocalMonthRange } from '../common/month-range';
import {
  AdminReviewsQueryDto,
  AdminSalonsQueryDto,
  CreateManagerDto,
  ModerateReviewDto,
  UpdateSalonAdminDto,
} from './dto/admin.dto';

/**
 * Même coût que `auth.service.ts`. La constante est dupliquée volontairement :
 * la partager créerait une dépendance entre deux modules pour une seule
 * valeur, et une divergence se verrait immédiatement au test.
 */
const BCRYPT_ROUNDS = 12;

/**
 * ============================================
 * Console d'administration de la plateforme
 * ============================================
 * Ce service est le SEUL du projet à agir hors de tout périmètre de salon.
 * Partout ailleurs, la règle est de retrouver le salon par `ownerId` extrait
 * du JWT (CLAUDE.md §3.2) ; ici, c'est exactement l'inverse : on voit tout.
 *
 * C'est pour cette raison que la protection ne peut pas être négligée. Chaque
 * route passe par `JwtAuthGuard` puis `RolesGuard` avec `@Roles('ADMIN')`, et
 * un test de bout en bout vérifie qu'un gérant ordinaire reçoit un 403 sur
 * chacune d'elles. Une erreur ici ne fuiterait pas les données d'un salon,
 * mais celles de tous.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Vue d'ensemble
  // ============================================

  /**
   * Tableau de bord de la plateforme.
   *
   * Les salons en attente sont mis en avant parce que c'est la seule donnée
   * qui appelle une action immédiate : un gérant inscrit hier et non validé
   * est un client qui attend.
   */
  async overview() {
    const { start, end } = currentLocalMonthRange();

    const [
      salonsTotal,
      salonsActive,
      managers,
      reservationsThisMonth,
      clients,
      reviewsPublished,
      reviewsHidden,
    ] = await Promise.all([
      this.prisma.salon.count(),
      this.prisma.salon.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'MANAGER' } }),
      this.prisma.reservation.count({
        where: {
          createdAt: { gte: start, lt: end },
          status: { not: 'CANCELED' },
        },
      }),
      this.prisma.client.count(),
      this.prisma.review.count({ where: { isPublished: true } }),
      this.prisma.review.count({ where: { isPublished: false } }),
    ]);

    return {
      salons: {
        total: salonsTotal,
        active: salonsActive,
        pending: salonsTotal - salonsActive,
      },
      managers,
      reservationsThisMonth,
      clients,
      reviews: { published: reviewsPublished, hidden: reviewsHidden },
      monthResetsAt: end.toISOString(),
    };
  }

  // ============================================
  // Salons
  // ============================================

  /**
   * Liste des salons avec leur consommation du mois.
   *
   * Le comptage passe par un `groupBy` unique plutôt que par un appel de
   * quota par salon : sur une liste de cinquante salons, la seconde approche
   * ferait cent requêtes pour afficher un tableau.
   */
  async findSalons(query: AdminSalonsQueryDto) {
    const status = query.status ?? 'all';
    const term = query.q?.trim();

    const salons = await this.prisma.salon.findMany({
      where: {
        ...(status === 'pending' && { isActive: false }),
        ...(status === 'active' && { isActive: true }),
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { slug: { contains: term, mode: 'insensitive' as const } },
            { owner: { phone: { contains: term } } },
          ],
        }),
      },
      orderBy: [{ isActive: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        district: true,
        isActive: true,
        plan: true,
        featuredUntil: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            lastLogin: true,
            mustChangePassword: true,
          },
        },
        _count: { select: { prestations: true, employees: true } },
      },
    });

    const { start, end } = currentLocalMonthRange();
    const used = await this.prisma.reservation.groupBy({
      by: ['salonId'],
      where: {
        salonId: { in: salons.map((salon) => salon.id) },
        status: { not: 'CANCELED' },
        createdAt: { gte: start, lt: end },
      },
      _count: { _all: true },
    });

    const usedBySalon = new Map(
      used.map((row) => [row.salonId, row._count._all]),
    );
    const now = new Date();

    return salons.map((salon) => ({
      id: salon.id,
      slug: salon.slug,
      name: salon.name,
      city: salon.city,
      district: salon.district,
      isActive: salon.isActive,
      // Une date passée ne vaut pas mise en avant : c'est le piège qui avait
      // laissé des abonnements expirés en tête de la recherche.
      isFeatured: salon.featuredUntil !== null && salon.featuredUntil > now,
      featuredUntil: salon.featuredUntil?.toISOString() ?? null,
      createdAt: salon.createdAt.toISOString(),
      prestations: salon._count.prestations,
      employees: salon._count.employees,
      owner: {
        id: salon.owner.id,
        phone: salon.owner.phone,
        fullName: salon.owner.fullName,
        lastLogin: salon.owner.lastLogin?.toISOString() ?? null,
        mustChangePassword: salon.owner.mustChangePassword,
      },
      quota: buildQuotaStatus(salon.plan, usedBySalon.get(salon.id) ?? 0, end),
    }));
  }

  /** Validation, changement d'offre et mise en avant, en une seule route. */
  async updateSalon(salonId: string, dto: UpdateSalonAdminDto) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true },
    });

    if (!salon) {
      throw new NotFoundException('Salon introuvable');
    }

    const featuredUntil =
      dto.featuredWeeks === undefined
        ? undefined
        : dto.featuredWeeks === 0
          ? null
          : new Date(Date.now() + dto.featuredWeeks * 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.salon.update({
      where: { id: salon.id },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.plan !== undefined && { plan: dto.plan }),
        ...(featuredUntil !== undefined && { featuredUntil }),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        plan: true,
        featuredUntil: true,
      },
    });

    return {
      ...updated,
      featuredUntil: updated.featuredUntil?.toISOString() ?? null,
    };
  }

  // ============================================
  // Gérants
  // ============================================

  /**
   * Crée un gérant et son salon — l'onboarding commercial, jusqu'ici réservé
   * à `prisma/create-manager.ts`.
   *
   * Le mot de passe est **généré** et renvoyé une seule fois. Laisser
   * l'administrateur en choisir un reviendrait à ce que deux personnes
   * connaissent durablement le secret qui protège l'agenda du salon ; le
   * compte est donc créé avec `mustChangePassword`, et le gérant le remplace
   * à sa première connexion.
   */
  async createManager(dto: CreateManagerDto) {
    const phone = toE164(dto.phone);
    const contactPhone = toE164(dto.contactPhone);

    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (existing) {
      // Message explicite, contrairement à l'inscription publique : cette
      // route n'est atteignable que par la plateforme, il n'y a personne à
      // qui cacher l'existence d'un compte.
      throw new ConflictException(`Un compte existe déjà avec ${phone}`);
    }

    const slug = await uniqueSlug(dto.salonName, async (candidate) => {
      const taken = await this.prisma.salon.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return taken !== null;
    });

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          fullName: dto.fullName,
          passwordHash,
          role: 'MANAGER',
          mustChangePassword: true,
        },
        select: { id: true, phone: true, fullName: true },
      });

      const salon = await tx.salon.create({
        data: {
          slug,
          name: dto.salonName,
          addressLine: dto.addressLine,
          district: dto.district,
          city: dto.city ?? DEFAULT_CITY,
          contactPhone,
          isWomenOnly: dto.isWomenOnly ?? false,
          openingHours: DEFAULT_OPENING_HOURS,
          photos: [],
          // Créé par la plateforme : la validation manuelle n'a plus d'objet.
          isActive: dto.isActive ?? true,
          ownerId: user.id,
        },
        select: { id: true, slug: true, name: true, isActive: true },
      });

      return { user, salon };
    });

    return {
      ...created,
      // Seule et unique occasion de le lire.
      password,
    };
  }

  /**
   * Réinitialise le mot de passe d'un gérant qui a perdu le sien.
   *
   * ⚠️ Les JWT déjà émis restent valables jusqu'à leur expiration : cette
   * route dépanne un gérant, elle ne coupe pas l'accès d'un compte compromis
   * (docs/SECURITY.md §1, « Révocation des JWT »).
   */
  async resetManagerPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Compte introuvable');
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });

    return { id: user.id, phone: user.phone, password };
  }

  // ============================================
  // Modération des avis
  // ============================================

  /**
   * Avis de toute la plateforme.
   *
   * Le filtre par note maximale sert le cas réel : un gérant signale un avis
   * à une étoile, on veut retrouver rapidement les notes basses récentes sans
   * parcourir tout l'historique.
   */
  async findReviews(query: AdminReviewsQueryDto) {
    const visibility = query.visibility ?? 'all';

    const reviews = await this.prisma.review.findMany({
      where: {
        ...(visibility === 'published' && { isPublished: true }),
        ...(visibility === 'hidden' && { isPublished: false }),
        ...(query.maxRating !== undefined && {
          rating: { lte: query.maxRating },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        isPublished: true,
        createdAt: true,
        salon: { select: { slug: true, name: true } },
        reservation: { select: { clientFirstName: true, startsAt: true } },
      },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isPublished: review.isPublished,
      createdAt: review.createdAt.toISOString(),
      salonSlug: review.salon.slug,
      salonName: review.salon.name,
      clientFirstName: review.reservation.clientFirstName,
      visitedAt: review.reservation.startsAt.toISOString(),
    }));
  }

  /**
   * Masque ou republie un avis.
   *
   * Réservé à la plateforme : le gérant n'a aucune route équivalente, et c'est
   * délibéré — un salon capable de cacher ses mauvaises notes rendrait tout le
   * système d'avis sans valeur.
   */
  async moderateReview(reviewId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException('Avis introuvable');
    }

    return this.prisma.review.update({
      where: { id: review.id },
      data: { isPublished: dto.isPublished },
      select: { id: true, isPublished: true },
    });
  }
}
