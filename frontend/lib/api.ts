/**
 * ============================================
 * Client HTTP de l'API Mawid
 * ============================================
 *
 * Une subtilité qui coûte cher si on l'ignore : le navigateur et le serveur
 * Next n'atteignent PAS le backend par la même URL. Le navigateur passe par
 * `localhost:3001` (port publié), le serveur Next par `backend:3001` (nom du
 * service Docker). Un seul `NEXT_PUBLIC_API_URL` casserait donc la moitié des
 * appels selon l'endroit où le composant s'exécute.
 */

const BROWSER_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Utilisée uniquement côté serveur ; retombe sur l'URL publique si absente. */
const SERVER_BASE_URL = process.env.BACKEND_INTERNAL_URL ?? BROWSER_BASE_URL;

function baseUrl(): string {
  return typeof window === 'undefined' ? SERVER_BASE_URL : BROWSER_BASE_URL;
}

/** Erreur d'API, porteuse du statut HTTP pour que l'appelant puisse décider. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Le créneau a été pris entre l'affichage et la validation. */
  get isSlotConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  /** `no-store` par défaut : disponibilités et agendas doivent être frais. */
  cache?: RequestCache;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, cache = 'no-store' } = options;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      cache,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    // Panne réseau ou backend injoignable : on ne laisse pas fuiter une
    // erreur technique brute vers l'interface.
    throw new ApiError(0, 'NETWORK');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload));
  }

  return payload as T;
}

/**
 * NestJS renvoie `message` en chaîne, ou en tableau quand le ValidationPipe
 * remonte plusieurs erreurs de DTO d'un coup.
 */
function extractMessage(payload: unknown): string {
  if (payload === null || typeof payload !== 'object') {
    return 'ERROR';
  }

  const message = (payload as { message?: unknown }).message;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }

  return 'ERROR';
}

// ============================================
// Types de l'API (miroir des réponses backend)
// ============================================

export interface DayHours {
  open: string;
  close: string;
}

export type OpeningHours = Record<string, DayHours | null>;

export interface PublicPrestation {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

export interface PublicSalon {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  addressLine: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: OpeningHours;
  photos: string[];
  isActive: boolean;
  contactPhone: string;
  isWomenOnly: boolean;
  /** Équipe active (V2). Vide : le salon n'a pas d'employés, parcours V1. */
  employees: PublicEmployee[];
  prestations: PublicPrestation[];
  rating: RatingSummary;
}

export interface PublicEmployee {
  id: string;
  fullName: string;
}

/** `average` vaut null sans aucun avis — jamais 0, qui pénaliserait un salon
 *  qui vient d'ouvrir. */
export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  clientFirstName: string;
  employeeName: string | null;
}

export interface SalonReviews extends RatingSummary {
  items: PublicReview[];
}

export function getSalonReviews(slug: string): Promise<SalonReviews> {
  return apiFetch<SalonReviews>(
    `/salons/${encodeURIComponent(slug)}/reviews`,
  );
}

export function createReview(
  token: string,
  input: { rating: number; comment?: string; website?: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/reservations/token/${encodeURIComponent(token)}/review`,
    { method: 'POST', body: input },
  );
}

export interface AvailableSlot {
  startsAt: string;
  localTime: string;
}

export interface Availability {
  date: string;
  totalDurationMinutes: number;
  slots: AvailableSlot[];
}

export interface ReservationPrestationLine {
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface ReservationView {
  id: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  status: 'CONFIRMED' | 'HONORED' | 'NO_SHOW' | 'CANCELED';
  clientFirstName: string;
  prestations: ReservationPrestationLine[];
  totalPriceCents: number;
  salon?: { name: string; slug: string; contactPhone: string };
  /** Présent uniquement dans la réponse de création. */
  cancellationToken?: string;
  /** Présent sur la lecture par token : un avis a-t-il déjà été déposé ? */
  hasReview?: boolean;
}

// ============================================
// Routes publiques
// ============================================

export interface SalonSearchItem {
  slug: string;
  name: string;
  district: string;
  city: string;
  isWomenOnly: boolean;
  photo: string | null;
  fromPriceCents: number | null;
  rating: RatingSummary;
  /** Mise en avant payante, en cours de validité (add-on §8.2). */
  isFeatured: boolean;
}

export interface SalonSearchResult {
  total: number;
  limit: number;
  offset: number;
  items: SalonSearchItem[];
}

export interface SearchFilters {
  city?: string;
  q?: string;
  womenOnly?: boolean;
}

export function searchSalons(
  filters: SearchFilters,
): Promise<SalonSearchResult> {
  const query = new URLSearchParams();
  if (filters.city) query.set('city', filters.city);
  if (filters.q) query.set('q', filters.q);
  if (filters.womenOnly) query.set('womenOnly', 'true');

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<SalonSearchResult>(`/salons${suffix}`);
}

export interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

export function getSalonSitemap(): Promise<SitemapEntry[]> {
  return apiFetch<SitemapEntry[]>('/salons/sitemap');
}

export function getPublicSalon(slug: string): Promise<PublicSalon> {
  return apiFetch<PublicSalon>(`/salons/${encodeURIComponent(slug)}`);
}

export function getAvailability(
  slug: string,
  date: string,
  prestationIds: string[],
  employeeId?: string,
): Promise<Availability> {
  const query = new URLSearchParams({
    date,
    prestationIds: prestationIds.join(','),
  });
  if (employeeId) {
    query.set('employeeId', employeeId);
  }
  return apiFetch<Availability>(
    `/salons/${encodeURIComponent(slug)}/availability?${query.toString()}`,
  );
}

export interface CreateReservationInput {
  startsAt: string;
  prestationIds: string[];
  /** Membre souhaité (V2). Omis : le serveur choisit une ressource libre. */
  employeeId?: string;
  clientFirstName: string;
  clientPhone: string;
  /** Piège à robots : doit rester vide (voir docs/SECURITY.md §1.1). */
  website?: string;
}

export function createReservation(
  slug: string,
  input: CreateReservationInput,
): Promise<ReservationView> {
  return apiFetch<ReservationView>(
    `/salons/${encodeURIComponent(slug)}/reservations`,
    { method: 'POST', body: input },
  );
}

export function getReservationByToken(token: string): Promise<ReservationView> {
  return apiFetch<ReservationView>(
    `/reservations/token/${encodeURIComponent(token)}`,
  );
}

export function cancelReservationByToken(
  token: string,
): Promise<{ status: 'CANCELED' }> {
  return apiFetch<{ status: 'CANCELED' }>(
    `/reservations/token/${encodeURIComponent(token)}`,
    { method: 'DELETE' },
  );
}

/**
 * Créneaux proposés pour DÉPLACER un rendez-vous.
 *
 * Route distincte de la disponibilité publique : celle-ci exclut le
 * rendez-vous lui-même des intervalles occupés, sans quoi il se bloquerait
 * et un décalage de quinze minutes serait refusé. L'exclusion est déduite du
 * token, jamais acceptée depuis l'URL.
 */
export function getRescheduleOptions(
  token: string,
  date: string,
): Promise<Availability> {
  const query = new URLSearchParams({ date });

  return apiFetch<Availability>(
    `/reservations/token/${encodeURIComponent(token)}/availability?${query.toString()}`,
  );
}

export function rescheduleReservationByToken(
  token: string,
  startsAt: string,
): Promise<ReservationView> {
  return apiFetch<ReservationView>(
    `/reservations/token/${encodeURIComponent(token)}/reschedule`,
    { method: 'PATCH', body: { startsAt } },
  );
}
