import { apiFetch, type OpeningHours } from './api';

/**
 * ============================================
 * API du back-office gérant
 * ============================================
 * Toutes ces routes exigent le JWT. Aucune ne prend d'identifiant de salon :
 * le backend le retrouve systématiquement via `ownerId` extrait du jeton,
 * ce qui est la seule isolation entre salons (pas de RLS — docs/SECURITY.md §3).
 */

export interface AuthenticatedUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: 'MANAGER' | 'ADMIN';
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export function login(
  phone: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { phone, password },
  });
}

export function getMe(token: string): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>('/auth/me', { token });
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ changed: true }> {
  return apiFetch<{ changed: true }>('/auth/password', {
    method: 'PATCH',
    token,
    body: { currentPassword, newPassword },
  });
}

// ============================================
// Salon
// ============================================

export interface ManagedSalon {
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
  contactPhone: string;
  isWomenOnly: boolean;
  isActive: boolean;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
}

export function getMySalon(token: string): Promise<ManagedSalon> {
  return apiFetch<ManagedSalon>('/salons/me', { token });
}

export interface UpdateSalonInput {
  name?: string;
  description?: string;
  addressLine?: string;
  district?: string;
  openingHours?: OpeningHours;
}

export function updateMySalon(
  token: string,
  input: UpdateSalonInput,
): Promise<ManagedSalon> {
  return apiFetch<ManagedSalon>('/salons/me', {
    method: 'PATCH',
    token,
    body: input,
  });
}

// ============================================
// Prestations
// ============================================

export interface ManagedPrestation {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  displayOrder: number;
}

export function getMyPrestations(
  token: string,
): Promise<ManagedPrestation[]> {
  return apiFetch<ManagedPrestation[]>('/prestations/me', { token });
}

export interface PrestationInput {
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  displayOrder?: number;
}

export function createPrestation(
  token: string,
  input: PrestationInput,
): Promise<ManagedPrestation> {
  return apiFetch<ManagedPrestation>('/prestations', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updatePrestation(
  token: string,
  id: string,
  input: Partial<PrestationInput> & { isActive?: boolean },
): Promise<ManagedPrestation> {
  return apiFetch<ManagedPrestation>(
    `/prestations/${encodeURIComponent(id)}`,
    { method: 'PATCH', token, body: input },
  );
}

export function archivePrestation(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/prestations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

// ============================================
// Agenda
// ============================================

export interface AgendaPrestation {
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface AgendaReservation {
  id: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  status: 'CONFIRMED' | 'HONORED' | 'NO_SHOW' | 'CANCELED';
  employeeId: string | null;
  clientFirstName: string;
  clientPhone: string;
  internalNote: string | null;
  prestations: AgendaPrestation[];
  totalPriceCents: number;
}

export function getAgenda(
  token: string,
  from?: string,
  to?: string,
): Promise<AgendaReservation[]> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<AgendaReservation[]>(`/reservations/me${suffix}`, { token });
}

export type ManagerStatus = 'HONORED' | 'NO_SHOW' | 'CANCELED';

export function updateReservationStatus(
  token: string,
  id: string,
  status: ManagerStatus,
): Promise<unknown> {
  return apiFetch(`/reservations/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

// ============================================
// Créneaux bloqués
// ============================================

export interface BlockedSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  reason: string | null;
}

export function getBlockedSlots(
  token: string,
  from?: string,
  to?: string,
): Promise<BlockedSlot[]> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<BlockedSlot[]>(`/blocked-slots${suffix}`, { token });
}

export function createBlockedSlot(
  token: string,
  input: { startsAt: string; endsAt: string; reason?: string },
): Promise<BlockedSlot> {
  return apiFetch<BlockedSlot>('/blocked-slots', {
    method: 'POST',
    token,
    body: input,
  });
}

export function deleteBlockedSlot(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/blocked-slots/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}
