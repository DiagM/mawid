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

export interface RegisterInput {
  phone: string;
  fullName: string;
  password: string;
  salonName: string;
  addressLine: string;
  district: string;
  contactPhone: string;
  isWomenOnly?: boolean;
  /** Piège à robots : doit rester vide (docs/SECURITY.md §1.1). */
  website?: string;
}

export function register(input: RegisterInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/register', {
    method: 'POST',
    body: input,
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
// Équipe (V2)
// ============================================

export interface ManagedEmployee {
  id: string;
  fullName: string;
  isActive: boolean;
  displayOrder: number;
  workingHours: OpeningHours | null;
}

export function getMyEmployees(token: string): Promise<ManagedEmployee[]> {
  return apiFetch<ManagedEmployee[]>('/employees', { token });
}

export function createEmployee(
  token: string,
  input: { fullName: string; displayOrder?: number },
): Promise<ManagedEmployee> {
  return apiFetch<ManagedEmployee>('/employees', {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateEmployee(
  token: string,
  id: string,
  input: { fullName?: string; isActive?: boolean; displayOrder?: number },
): Promise<ManagedEmployee> {
  return apiFetch<ManagedEmployee>(`/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function archiveEmployee(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/employees/${encodeURIComponent(id)}`, {
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
// Statistiques (V2)
// ============================================

export interface StatsCounts {
  confirmed: number;
  honored: number;
  noShow: number;
  canceled: number;
  total: number;
}

export interface PeriodStats {
  revenueCents: number;
  counts: StatsCounts;
  averageBasketCents: number | null;
  noShowRate: number | null;
}

export interface ManagerStats {
  period: { from: string; to: string };
  current: PeriodStats;
  /** Même durée, juste avant : c'est ce qui rend la comparaison honnête. */
  previous: PeriodStats;
  topPrestations: { name: string; count: number; revenueCents: number }[];
  byEmployee: {
    id: string;
    fullName: string;
    count: number;
    revenueCents: number;
  }[];
  clients: { total: number; returning: number; new: number };
}

export function getStats(
  token: string,
  from?: string,
  to?: string,
): Promise<ManagerStats> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<ManagerStats>(`/stats/me${suffix}`, { token });
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
