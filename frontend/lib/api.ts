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
  prestations: PublicPrestation[];
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
}

// ============================================
// Routes publiques
// ============================================

export function getPublicSalon(slug: string): Promise<PublicSalon> {
  return apiFetch<PublicSalon>(`/salons/${encodeURIComponent(slug)}`);
}

export function getAvailability(
  slug: string,
  date: string,
  prestationIds: string[],
): Promise<Availability> {
  const query = new URLSearchParams({
    date,
    prestationIds: prestationIds.join(','),
  });
  return apiFetch<Availability>(
    `/salons/${encodeURIComponent(slug)}/availability?${query.toString()}`,
  );
}

export interface CreateReservationInput {
  startsAt: string;
  prestationIds: string[];
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
