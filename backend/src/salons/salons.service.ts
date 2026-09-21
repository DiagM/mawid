import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SearchSalonsDto } from './dto/search-salons.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { MapsLinkService } from './maps-link.service';
import { haversineMeters } from '../common/geo';

/**
 * Colonnes renvoyees par la recherche publique.
 *
 * Constante de module parce que les DEUX chemins de recherche - par nom et
 * par distance - doivent renvoyer exactement la meme forme. Les dupliquer
 * laisserait un jour l'un des deux exposer un champ interne.
 */
const SEARCH_SELECT = {
  // Interne : sert au regroupement des notes, retire de la reponse.
  id: true,
  slug: true,
  name: true,
  district: true,
  city: true,
  isWomenOnly: true,
  photos: true,
  featuredUntil: true,
  prestations: {
    where: { isActive: true },
    orderBy: { priceCents: 'asc' as const },
    take: 1,
    select: { priceCents: true },
  },
} satisfies Prisma.SalonSelect;

/** Une ligne telle que `SEARCH_SELECT` la produit. */
type SearchRow = Prisma.SalonGetPayload<{ select: typeof SEARCH_SELECT }>;

@Injectable()
export class SalonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly mapsLink: MapsLinkService,
  ) {}

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

    // La correspondance textuelle passe par une requête brute : Prisma ne sait
    // pas exprimer `unaccent()`, sans lequel « elegance » ne trouverait pas
    // « Élégance » ni « epilation » ne trouverait « Épilation ». Personne ne
    // tape les accents dans un champ de recherche sur téléphone.
    const matchedIds = query ? await this.findIdsMatching(query) : null;

    const where: Prisma.SalonWhereInput = {
      isActive: true,
      ...(dto.city && { city: dto.city }),
      ...(dto.womenOnly && { isWomenOnly: true }),
      ...(matchedIds !== null && { id: { in: matchedIds } }),
    };

    const now = new Date();

    /**
     * Mise en avant payante (add-on §8.2).
     *
     * ⚠️ Un simple `orderBy: { featuredUntil: 'desc', nulls: 'last' }` serait
     * FAUX : une date expirée reste une date non nulle, donc un salon qui a
     * cessé de payer continuerait de passer devant les autres. On sépare donc
     * explicitement les deux populations sur la date du jour.
     */
    const featuredWhere: Prisma.SalonWhereInput = {
      ...where,
      featuredUntil: { gt: now },
    };
    const regularWhere: Prisma.SalonWhereInput = {
      ...where,
      OR: [{ featuredUntil: null }, { featuredUntil: { lte: now } }],
      // `where` peut déjà porter un OR (recherche textuelle) : on les combine
      // avec AND plutôt que d'écraser silencieusement le premier.
      ...(where.OR && { AND: [{ OR: where.OR }], OR: undefined }),
    };

    const selectFields = SEARCH_SELECT;

    // Recherche « autour de moi » : les deux coordonnees vont ensemble.
    // Une seule trahit un appel mal forme ; trier par rapport a un point
    // situe sur l'equateur donnerait un classement absurde sans rien
    // signaler.
    if (dto.lat !== undefined && dto.lng !== undefined) {
      return this.searchAround(
        dto.lat,
        dto.lng,
        where,
        selectFields,
        limit,
        offset,
        now,
      );
    }

    // Deux requêtes plutôt qu'un tri en mémoire : la pagination doit rester
    // exacte, un salon mis en avant en page 2 devrait remonter en page 1.
    const [featured, featuredCount, total] = await Promise.all([
      this.prisma.salon.findMany({
        where: featuredWhere,
        orderBy: [{ name: 'asc' }],
        take: limit,
        skip: offset,
        select: selectFields,
      }),
      this.prisma.salon.count({ where: featuredWhere }),
      this.prisma.salon.count({ where }),
    ]);

    // On ne complète avec des salons ordinaires que si la page n'est pas
    // déjà remplie par les mis en avant.
    const remainingSlots = limit - featured.length;
    const regular =
      remainingSlots > 0
        ? await this.prisma.salon.findMany({
            where: regularWhere,
            orderBy: [{ name: 'asc' }],
            take: remainingSlots,
            skip: Math.max(0, offset - featuredCount),
            select: selectFields,
          })
        : [];

    const salons = [...featured, ...regular];

    return this.buildSearchResponse(salons, total, limit, offset, now);
  }

  /**
   * Identifiants des salons dont le nom, le quartier ou une prestation active
   * correspond au texte cherché, accents ignorés.
   *
   * On cherche aussi dans les prestations : un client tape « barbe » bien plus
   * souvent que le nom d'un salon qu'il ne connaît pas encore.
   *
   * Requête brute, mais **paramétrée** : le template `$queryRaw` de Prisma
   * échappe les valeurs, il n'y a pas de concaténation de chaîne. Seuls les
   * identifiants sont récupérés ici — la lecture des données reste typée par
   * Prisma juste après.
   */
  private async findIdsMatching(query: string): Promise<string[]> {
    // Les métacaractères LIKE doivent être neutralisés : sans ça, un client
    // tapant « % » listerait tous les salons.
    const escaped = query.replace(/[\\%_]/g, (match) => `\\${match}`);
    const pattern = `%${escaped}%`;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id
      FROM salons s
      WHERE s."isActive" = true
        AND (
          unaccent(s.name) ILIKE unaccent(${pattern})
          OR unaccent(s.district) ILIKE unaccent(${pattern})
          OR EXISTS (
            SELECT 1
            FROM prestations p
            WHERE p."salonId" = s.id
              AND p."isActive" = true
              AND unaccent(p.name) ILIKE unaccent(${pattern})
          )
        )
    `;

    return rows.map((row) => row.id);
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
        // Équipe active (V2) : le client peut choisir avec qui il réserve.
        // Vide tant que le salon n'a pas d'employés — le parcours reste alors
        // exactement celui de la V1.
        employees: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, fullName: true },
        },
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

    return {
      ...salon,
      rating: await this.reviews.summaryForSalon(salon.id),
    };
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
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.latitude !== undefined && { latitude: dto.latitude }),
      ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      ...(dto.openingHours !== undefined && {
        openingHours: dto.openingHours as unknown as Prisma.InputJsonValue,
      }),
      ...(dto.photos !== undefined && { photos: dto.photos }),
    };

    if (dto.mapsUrl !== undefined) {
      Object.assign(data, await this.positionFromLink(dto.mapsUrl));
    }

    return this.prisma.salon.update({
      where: { id: salon.id },
      data,
    });
  }

  /**
   * Recherche ordonnee par distance au client.
   *
   * Le tri se fait en memoire sur la liste COMPLETE des salons filtres, pas
   * sur une page : trier une page deja decoupee donnerait un ordre faux, un
   * salon proche resterait bloque en page 2. C'est la meme exigence que pour
   * la mise en avant plus haut, traitee autrement parce que Prisma ne sait
   * pas ordonner par une distance calculee.
   *
   * Tenable tant que le catalogue tient en memoire - quelques milliers de
   * salons. Au-dela, il faudra une requete brute avec un pre-filtre par
   * rectangle sur latitude/longitude.
   *
   * Les filtres viennent du MEME `where` que la recherche par nom : un salon
   * inactif ne peut donc pas reapparaitre par ce chemin.
   */
  private async searchAround(
    lat: number,
    lng: number,
    where: Prisma.SalonWhereInput,
    selectFields: typeof SEARCH_SELECT,
    limit: number,
    offset: number,
    now: Date,
  ) {
    const candidates = await this.prisma.salon.findMany({
      where,
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        featuredUntil: true,
      },
    });

    const ranked = candidates
      .map((salon) => ({
        id: salon.id,
        name: salon.name,
        isFeatured: salon.featuredUntil !== null && salon.featuredUntil > now,
        distanceMeters:
          salon.latitude !== null && salon.longitude !== null
            ? haversineMeters(lat, lng, salon.latitude, salon.longitude)
            : null,
      }))
      .sort(compareByProximity);

    const page = ranked.slice(offset, offset + limit);

    const salons = await this.prisma.salon.findMany({
      where: { id: { in: page.map((entry) => entry.id) } },
      select: selectFields,
    });

    // `findMany` ne garantit aucun ordre : on remet la page dans l'ordre
    // calcule, sinon le tri par distance serait perdu au dernier moment.
    const byId = new Map(salons.map((salon) => [salon.id, salon]));
    const ordered = page
      .map((entry) => byId.get(entry.id))
      .filter((salon): salon is SearchRow => salon !== undefined);

    const distances = new Map(
      page.map((entry) => [entry.id, entry.distanceMeters]),
    );

    return this.buildSearchResponse(
      ordered,
      ranked.length,
      limit,
      offset,
      now,
      distances,
    );
  }

  /**
   * Mise en forme commune aux deux chemins de recherche.
   *
   * `distances` est absente pour la recherche par nom : le champ vaut alors
   * `null` plutot que d'etre absent, pour que le frontend n'ait qu'une seule
   * forme a traiter.
   */
  private async buildSearchResponse(
    salons: SearchRow[],
    total: number,
    limit: number,
    offset: number,
    now: Date,
    distances?: Map<string, number | null>,
  ) {
    // Un agregat par salon produirait N+1 requetes sur une page de resultats.
    const ratings = await this.reviews.summariesForSalons(
      salons.map((salon) => salon.id),
    );

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
        // « A partir de » : le prix d'appel est ce qui fait cliquer, et il
        // evite d'afficher un catalogue complet dans une liste de resultats.
        fromPriceCents: salon.prestations[0]?.priceCents ?? null,
        rating: ratings.get(salon.id) ?? { average: null, count: 0 },
        // Une mise en avant expiree n'est plus signalee, meme si la date
        // reste en base : c'est la date qui fait foi, pas sa presence.
        isFeatured: salon.featuredUntil !== null && salon.featuredUntil > now,
        distanceMeters: distances?.get(salon.id) ?? null,
      })),
    };
  }

  /**
   * Traduit le lien colle par le gerant en latitude/longitude.
   *
   * Un lien illisible est REFUSE plutot qu'ignore : un gerant qui croit
   * avoir enregistre sa position, et dont les clientes se retrouvent sans
   * itineraire, ne saurait jamais d'ou vient le probleme.
   */
  private async positionFromLink(
    mapsUrl: string,
  ): Promise<Pick<Prisma.SalonUpdateInput, 'latitude' | 'longitude'>> {
    const trimmed = mapsUrl.trim();

    // Champ vide : le gerant retire sa position, ce qui est legitime.
    if (!trimmed) {
      return { latitude: null, longitude: null };
    }

    const point = await this.mapsLink.resolve(trimmed);

    if (!point) {
      throw new BadRequestException(
        'Lien Google Maps non reconnu. Ouvrez votre salon dans Google ' +
          'Maps, touchez Partager, puis collez le lien ici. Le salon doit ' +
          'se trouver en Algerie.',
      );
    }

    return { latitude: point.latitude, longitude: point.longitude };
  }
}

/**
 * Ordre des resultats « autour de moi ».
 *
 * Les salons SANS position passent en dernier plutot que d'etre exclus : les
 * ecarter ferait disparaitre du catalogue tout gerant n'ayant pas encore
 * colle son lien Maps, et c'est la cliente qui en paierait le prix.
 */
function compareByProximity(
  a: { isFeatured: boolean; distanceMeters: number | null; name: string },
  b: { isFeatured: boolean; distanceMeters: number | null; name: string },
): number {
  if (a.isFeatured !== b.isFeatured) {
    return a.isFeatured ? -1 : 1;
  }

  if (a.distanceMeters === null || b.distanceMeters === null) {
    if (a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters === null ? 1 : -1;
    }
    return a.name.localeCompare(b.name, 'fr');
  }

  return (
    a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name, 'fr')
  );
}
