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
  input: {
    fullName?: string;
    isActive?: boolean;
    displayOrder?: number;
    /** `null` = le membre suit les horaires du salon. */
    workingHours?: OpeningHours | null;
  },
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
// Caisse (V4)
// ============================================

export type CashType = 'SALE' | 'EXPENSE';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CashMovement {
  id: string;
  type: CashType;
  amountCents: number;
  label: string;
  method: PaymentMethod;
  localTime: string;
  employeeName: string | null;
  clientFirstName: string | null;
}

export interface CashDay {
  date: string;
  salesCents: number;
  expensesCents: number;
  /** Peut être négatif : une journée de gros achats est une information. */
  balanceCents: number;
  items: CashMovement[];
}

export interface PendingReservation {
  id: string;
  localTime: string;
  clientFirstName: string;
  employeeId: string | null;
  employeeName: string | null;
  label: string;
  amountCents: number;
}

export function getCashDay(token: string, date?: string): Promise<CashDay> {
  const suffix = date ? `?date=${date}` : '';
  return apiFetch<CashDay>(`/cash${suffix}`, { token });
}

export function getPendingReservations(
  token: string,
  date?: string,
): Promise<PendingReservation[]> {
  const suffix = date ? `?date=${date}` : '';
  return apiFetch<PendingReservation[]>(`/cash/pending${suffix}`, { token });
}

export interface CashMovementInput {
  type: CashType;
  amountCents: number;
  label: string;
  method?: PaymentMethod;
  reservationId?: string;
  employeeId?: string;
}

export function createCashMovement(
  token: string,
  input: CashMovementInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/cash', {
    method: 'POST',
    token,
    body: input,
  });
}

export function deleteCashMovement(
  token: string,
  id: string,
): Promise<void> {
  return apiFetch<void>(`/cash/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

// ============================================
// Stocks (V4)
// ============================================

export interface StockProduct {
  id: string;
  name: string;
  unit: string | null;
  costCents: number | null;
  quantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  /** Règle métier calculée côté serveur, identique pour toutes les vues. */
  isLowStock: boolean;
}

export function getProducts(token: string): Promise<StockProduct[]> {
  return apiFetch<StockProduct[]>('/products', { token });
}

export function createProduct(
  token: string,
  input: {
    name: string;
    unit?: string;
    costCents?: number;
    quantity?: number;
    lowStockThreshold?: number;
  },
): Promise<StockProduct> {
  return apiFetch<StockProduct>('/products', {
    method: 'POST',
    token,
    body: input,
  });
}

export function moveStock(
  token: string,
  productId: string,
  input: { delta: number; reason?: string },
): Promise<{ id: string; name: string; quantity: number }> {
  return apiFetch<{ id: string; name: string; quantity: number }>(
    `/products/${encodeURIComponent(productId)}/movements`,
    { method: 'POST', token, body: input },
  );
}

export function archiveProduct(
  token: string,
  productId: string,
): Promise<StockProduct> {
  return apiFetch<StockProduct>(
    `/products/${encodeURIComponent(productId)}`,
    { method: 'PATCH', token, body: { isActive: false } },
  );
}

// ============================================
// Quota et offre (V3)
// ============================================

export interface QuotaStatus {
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  /** `null` = illimité, aucun blocage possible. */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Le prochain client serait refusé. */
  isExceeded: boolean;
  /** Assez proche de la limite pour prévenir le gérant. */
  isNearLimit: boolean;
  resetsAt: string;
}

export function getQuota(token: string): Promise<QuotaStatus> {
  return apiFetch<QuotaStatus>('/reservations/quota', { token });
}

// ============================================
// Fiches clients (V3)
// ============================================

export interface ClientRow {
  id: string;
  firstName: string;
  phone: string;
  isBlocked: boolean;
  visits: number;
  noShows: number;
  canceled: number;
  totalSpentCents: number;
  lastVisit: string | null;
  nextVisit: string | null;
}

/**
 * Segments de clientèle.
 * `lapsed` exclut les clients ayant déjà un rendez-vous à venir : les
 * relancer serait à côté de la plaque, ils reviennent déjà.
 */
export type ClientSegment = 'all' | 'lapsed' | 'regulars';

export function getClients(
  token: string,
  options: { query?: string; segment?: ClientSegment } = {},
): Promise<{ total: number; items: ClientRow[] }> {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  if (options.segment && options.segment !== 'all') {
    params.set('segment', options.segment);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ total: number; items: ClientRow[] }>(
    `/clients${suffix}`,
    { token },
  );
}

export interface ClientReservation {
  id: string;
  localDate: string;
  startsAt: string;
  status: 'CONFIRMED' | 'HONORED' | 'NO_SHOW' | 'CANCELED';
  employeeName: string | null;
  internalNote: string | null;
  prestations: { name: string; priceCents: number }[];
  totalPriceCents: number;
}

export interface ClientDetail {
  id: string;
  firstName: string;
  phone: string;
  reservations: ClientReservation[];
  /** Bloquée DANS CE SALON. Distinct du bannissement plateforme. */
  isBlockedHere: boolean;
  blockReason: string | null;
}

export function getClient(
  token: string,
  id: string,
): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/clients/${encodeURIComponent(id)}`, {
    token,
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
  /** `null` = tout le salon est indisponible. */
  employeeId: string | null;
  employeeName: string | null;
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
  input: {
    startsAt: string;
    endsAt: string;
    reason?: string;
    /** Omis : tout le salon. Renseigné : ce membre seulement. */
    employeeId?: string;
  },
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

export function setClientBlocked(
  token: string,
  clientId: string,
  isBlocked: boolean,
  reason?: string,
): Promise<{ clientId: string; isBlockedHere: boolean }> {
  return apiFetch(`/clients/${encodeURIComponent(clientId)}/blocked`, {
    method: 'PATCH',
    token,
    body: { isBlocked, ...(reason && { reason }) },
  });
}

// ============================================
// Liste d'attente
// ============================================

export interface WaitlistEntry {
  id: string;
  desiredDate: string;
  clientFirstName: string;
  clientPhone: string;
  prestationsSummary: string;
  durationMinutes: number;
  note: string | null;
  /** Renseigné quand le gérant a déjà rappelé cette personne. */
  notifiedAt: string | null;
  createdAt: string;
}

export function getWaitlist(
  token: string,
  from?: string,
  to?: string,
): Promise<WaitlistEntry[]> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<WaitlistEntry[]>(`/waitlist${suffix}`, { token });
}

export function setWaitlistNotified(
  token: string,
  id: string,
  notified: boolean,
): Promise<unknown> {
  return apiFetch(`/waitlist/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: { notified },
  });
}

export function removeWaitlistEntry(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/waitlist/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

// ============================================
// Rappels de la veille
// ============================================

export interface ReminderItem {
  id: string;
  localTime: string;
  clientFirstName: string;
  clientPhone: string;
  /** Sert à construire le lien de gestion glissé dans le message. */
  cancellationToken: string;
  remindedAt: string | null;
  employeeName: string | null;
  prestations: string;
}

export interface Reminders {
  date: string;
  items: ReminderItem[];
}

export function getReminders(
  token: string,
  date?: string,
): Promise<Reminders> {
  const suffix = date ? `?from=${encodeURIComponent(date)}` : '';

  return apiFetch<Reminders>(`/reservations/reminders${suffix}`, { token });
}

export function setReminded(
  token: string,
  id: string,
  reminded: boolean,
): Promise<unknown> {
  return apiFetch(`/reservations/${encodeURIComponent(id)}/reminded`, {
    method: 'PATCH',
    token,
    body: { reminded },
  });
}

// ============================================
// Photos du salon
// ============================================

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/** Autorisation d'envoi, limitée au dossier du salon du gérant connecté. */
export function getUploadSignature(token: string): Promise<UploadSignature> {
  return apiFetch<UploadSignature>('/salons/me/photos/signature', {
    method: 'POST',
    token,
  });
}

/**
 * Enregistre une photo déposée.
 *
 * On n'envoie que l'identifiant : c'est le backend qui relit l'adresse
 * définitive auprès de l'hébergeur. Transmettre l'URL depuis le navigateur
 * permettrait d'en inventer une.
 */
export function confirmPhoto(
  token: string,
  publicId: string,
): Promise<{ photos: string[] }> {
  return apiFetch('/salons/me/photos', {
    method: 'POST',
    token,
    body: { publicId },
  });
}

export function deletePhoto(
  token: string,
  url: string,
): Promise<{ photos: string[] }> {
  return apiFetch('/salons/me/photos', {
    method: 'DELETE',
    token,
    body: { url },
  });
}

export function reorderPhotos(
  token: string,
  photos: string[],
): Promise<{ photos: string[] }> {
  return apiFetch('/salons/me/photos', {
    method: 'PATCH',
    token,
    body: { photos },
  });
}

// ============================================
// Demandes adressées à Mawid
// ============================================

export function createTicketAsManager(
  token: string,
  input: import('./api').CreateTicketInput,
): Promise<{ id: string }> {
  return apiFetch('/support/tickets/mine', {
    method: 'POST',
    token,
    body: input,
  });
}

export interface SupportTicket {
  id: string;
  kind: 'UPGRADE' | 'ISSUE' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  subject: string;
  message: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  requestedPlan: 'PRO' | 'PRO_PLUS' | null;
  internalNote: string | null;
  createdAt: string;
  closedAt: string | null;
  salon: { slug: string; name: string; plan: string } | null;
}

export function getTickets(
  token: string,
  status?: string,
): Promise<SupportTicket[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';

  return apiFetch<SupportTicket[]>(`/admin/tickets${suffix}`, { token });
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
