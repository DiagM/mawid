import { apiFetch } from './api';
import type { QuotaStatus } from './api-pro';

/**
 * ============================================
 * API de la console d'administration
 * ============================================
 * Ces routes sont les seules du produit qui ne sont pas cantonnées à un
 * salon : elles voient toute la plateforme. Le backend les protège par
 * `JwtAuthGuard` + `RolesGuard` et le rôle est relu en base à chaque requête.
 *
 * Le contrôle fait côté Next (`requireAdminToken`) n'est qu'un confort
 * d'affichage : il évite de montrer une console vide à un gérant, il ne
 * protège rien.
 */

export interface PlatformOverview {
  salons: { total: number; active: number; pending: number };
  managers: number;
  reservationsThisMonth: number;
  clients: number;
  reviews: { published: number; hidden: number };
  monthResetsAt: string;
}

export interface AdminSalon {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string;
  isActive: boolean;
  isFeatured: boolean;
  featuredUntil: string | null;
  createdAt: string;
  prestations: number;
  employees: number;
  owner: {
    id: string;
    phone: string;
    fullName: string | null;
    lastLogin: string | null;
    mustChangePassword: boolean;
  };
  quota: QuotaStatus;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  isPublished: boolean;
  createdAt: string;
  salonSlug: string;
  salonName: string;
  clientFirstName: string;
  visitedAt: string;
}

export function getOverview(token: string): Promise<PlatformOverview> {
  return apiFetch<PlatformOverview>('/admin/overview', { token });
}

export function getSalons(
  token: string,
  params: { status?: string; q?: string } = {},
): Promise<AdminSalon[]> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params.q) {
    query.set('q', params.q);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<AdminSalon[]>(`/admin/salons${suffix}`, { token });
}

export function updateSalon(
  token: string,
  salonId: string,
  body: { isActive?: boolean; plan?: string; featuredWeeks?: number },
): Promise<unknown> {
  return apiFetch(`/admin/salons/${salonId}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export interface CreateManagerInput {
  phone: string;
  fullName: string;
  salonName: string;
  addressLine: string;
  district: string;
  city?: string;
  contactPhone: string;
  isWomenOnly?: boolean;
}

export interface CreatedManager {
  user: { id: string; phone: string; fullName: string | null };
  salon: { id: string; slug: string; name: string; isActive: boolean };
  /** Affiché une seule fois — jamais relisible ensuite. */
  password: string;
}

export function createManager(
  token: string,
  input: CreateManagerInput,
): Promise<CreatedManager> {
  return apiFetch<CreatedManager>('/admin/managers', {
    method: 'POST',
    token,
    body: input,
  });
}

export function resetManagerPassword(
  token: string,
  userId: string,
): Promise<{ id: string; phone: string; password: string }> {
  return apiFetch(`/admin/managers/${userId}/reset-password`, {
    method: 'POST',
    token,
  });
}

export function getReviews(
  token: string,
  params: { visibility?: string; maxRating?: number } = {},
): Promise<AdminReview[]> {
  const query = new URLSearchParams();
  if (params.visibility && params.visibility !== 'all') {
    query.set('visibility', params.visibility);
  }
  if (params.maxRating !== undefined) {
    query.set('maxRating', String(params.maxRating));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<AdminReview[]>(`/admin/reviews${suffix}`, { token });
}

export function moderateReview(
  token: string,
  reviewId: string,
  isPublished: boolean,
): Promise<unknown> {
  return apiFetch(`/admin/reviews/${reviewId}`, {
    method: 'PATCH',
    token,
    body: { isPublished },
  });
}

export function updateTicket(
  token: string,
  id: string,
  body: { status?: string; internalNote?: string },
): Promise<unknown> {
  return apiFetch(`/admin/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body,
  });
}
