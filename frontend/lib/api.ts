/**
 * Petit client HTTP typé pour l'API Mawid.
 *
 * Toutes les fonctions lèvent une `ApiError` (avec le message renvoyé par le
 * backend, prêt à être affiché tel quel à l'utilisateur) en cas de réponse
 * non-2xx, pour que les pages puissent l'attraper simplement avec try/catch.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Forme brute des erreurs de validation de Nest (ValidationPipe par défaut). */
interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as NestErrorBody).message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "Configuration manquante : NEXT_PUBLIC_API_URL n'est pas définie.",
      0,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Impossible de contacter le serveur. Vérifie ta connexion et réessaie.",
      0,
    );
  }

  const rawText = await res.text();
  let body: unknown = null;
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      extractMessage(body, `Une erreur est survenue (${res.status}).`),
      res.status,
    );
  }

  return body as T;
}

// ============================================
// Types — reflètent les DTOs du backend NestJS
// ============================================

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningHours = Record<
  Weekday,
  { open: string; close: string } | null
>;

export interface Prestation {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

export interface Salon {
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
  prestations: Prestation[];
}

export interface AvailabilityDay {
  date: string; // "YYYY-MM-DD"
  slots: string[]; // "HH:mm", heure d'Alger
}

export interface CreateReservationInput {
  prestationIds: string[];
  startsAt: string;
  clientFirstName: string;
  clientPhone: string;
}

export type ReservationStatus =
  | "CONFIRMED"
  | "HONORED"
  | "NO_SHOW"
  | "CANCELED";

export interface ReservationPrestation {
  prestationId: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface Reservation {
  id: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  clientFirstName: string;
  clientPhone: string;
  cancellationToken: string;
  prestations: ReservationPrestation[];
  totalPriceCents: number;
  totalDurationMinutes: number;
  whatsappConfirmationUrl: string;
}

export interface ReservationWithSalon
  extends Omit<Reservation, "whatsappConfirmationUrl"> {
  salonName: string;
}

// ============================================
// Appels API
// ============================================

export const api = {
  getSalon(slug: string): Promise<Salon> {
    return request<Salon>(`/salons/${encodeURIComponent(slug)}`);
  },

  getAvailability(
    slug: string,
    prestationIds: string[],
    days = 7,
  ): Promise<AvailabilityDay[]> {
    const params = new URLSearchParams({
      prestationIds: prestationIds.join(","),
      days: String(days),
    });
    return request<AvailabilityDay[]>(
      `/salons/${encodeURIComponent(slug)}/availability?${params.toString()}`,
    );
  },

  createReservation(
    slug: string,
    payload: CreateReservationInput,
  ): Promise<Reservation> {
    return request<Reservation>(
      `/salons/${encodeURIComponent(slug)}/reservations`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  getReservationByToken(token: string): Promise<ReservationWithSalon> {
    return request<ReservationWithSalon>(
      `/reservations/token/${encodeURIComponent(token)}`,
    );
  },

  cancelReservation(token: string): Promise<ReservationWithSalon> {
    return request<ReservationWithSalon>(
      `/reservations/token/${encodeURIComponent(token)}/cancel`,
      { method: "POST" },
    );
  },
};
