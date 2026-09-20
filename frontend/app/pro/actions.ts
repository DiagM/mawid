'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import * as pro from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { toE164 } from '@/lib/format';
import {
  createSession,
  destroySession,
  requireSessionToken,
} from '@/lib/session';

/**
 * ============================================
 * Server Actions du back-office
 * ============================================
 * ⚠️ Une Server Action est joignable par un POST direct, sans passer par
 * l'interface. Chacune doit donc vérifier la session elle-même : un contrôle
 * dans un layout ne protégerait rien.
 *
 * L'autorisation de fond reste côté backend, qui retrouve le salon via
 * `ownerId` extrait du JWT. Le jeton ne transite jamais par le client : il
 * vit dans un cookie `httpOnly` (voir lib/session.ts).
 */

export interface ActionState {
  error?: string;
  success?: string;
}

/** Traduit une erreur d'API en message affichable, sans détail technique. */
function toMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return fr.common.networkError;
    }
    if (error.status === 429) {
      return fr.pro.tooManyAttempts;
    }
    if (error.status === 401) {
      return fr.pro.invalidCredentials;
    }
    return error.message;
  }
  return fallback;
}

// ============================================
// Authentification
// ============================================

export async function loginAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const phoneInput = String(formData.get('phone') ?? '');
  const password = String(formData.get('password') ?? '');

  const phone = toE164(phoneInput);
  if (!phone || password.length === 0) {
    // Message identique à celui d'un mauvais mot de passe : ne jamais laisser
    // deviner si un numéro existe (docs/SECURITY.md §2).
    return { error: fr.pro.invalidCredentials };
  }

  let mustChangePassword: boolean;
  try {
    const result = await pro.login(phone, password);
    await createSession(result.accessToken);
    mustChangePassword = result.user.mustChangePassword;
  } catch (error) {
    return { error: toMessage(error, fr.pro.invalidCredentials) };
  }

  // `redirect` lève une exception de contrôle de flux : il doit rester hors
  // du try/catch, sinon il serait intercepté comme une erreur.
  redirect(mustChangePassword ? '/pro/mot-de-passe' : '/pro');
}

/**
 * Inscription self-service.
 *
 * Le salon créé est inactif : invisible en recherche et fiche publique en 404
 * jusqu'à validation manuelle. Le gérant est connecté immédiatement pour
 * pouvoir préparer ses prestations et ses horaires en attendant.
 */
export async function registerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const phone = toE164(String(formData.get('phone') ?? ''));
  const contactPhone = toE164(String(formData.get('contactPhone') ?? ''));

  if (!phone || !contactPhone) {
    return { error: fr.booking.phoneInvalid };
  }

  try {
    const result = await pro.register({
      phone,
      fullName: String(formData.get('fullName') ?? ''),
      password: String(formData.get('password') ?? ''),
      salonName: String(formData.get('salonName') ?? ''),
      addressLine: String(formData.get('addressLine') ?? ''),
      district: String(formData.get('district') ?? ''),
      contactPhone,
      isWomenOnly: formData.get('isWomenOnly') === 'on',
      website: String(formData.get('website') ?? ''),
    });

    await createSession(result.accessToken);
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  redirect('/pro/salon');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/pro/connexion');
}

export async function changePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  try {
    await pro.changePassword(token, currentPassword, newPassword);
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  redirect('/pro');
}

// ============================================
// Salon
// ============================================

export async function updateSalonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const openingHours: Record<string, { open: string; close: string } | null> =
    {};

  for (const day of [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]) {
    const isOpen = formData.get(`${day}-open`) === 'on';
    const from = String(formData.get(`${day}-from`) ?? '');
    const to = String(formData.get(`${day}-to`) ?? '');

    if (!isOpen || !from || !to) {
      openingHours[day] = null;
      continue;
    }

    // Une fermeture antérieure à l'ouverture produirait une journée sans
    // aucun créneau, sans que le gérant comprenne pourquoi.
    if (to <= from) {
      return { error: fr.pro.salon.invalidHours };
    }

    openingHours[day] = { open: from, close: to };
  }

  try {
    await pro.updateMySalon(token, {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      addressLine: String(formData.get('addressLine') ?? ''),
      district: String(formData.get('district') ?? ''),
      openingHours,
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/salon');
  return { success: fr.pro.saved };
}

// ============================================
// Prestations
// ============================================

export async function createPrestationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const durationMinutes = Number(formData.get('durationMinutes'));
  const priceDinars = Number(formData.get('priceDinars'));

  if (!Number.isFinite(durationMinutes) || !Number.isFinite(priceDinars)) {
    return { error: fr.common.error };
  }

  try {
    await pro.createPrestation(token, {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      durationMinutes,
      // Le gérant saisit des dinars, la base stocke des centimes entiers
      // (CLAUDE.md §3.5) : la conversion se fait ici, une seule fois.
      priceCents: Math.round(priceDinars * 100),
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/prestations');
  return { success: fr.pro.saved };
}

export async function archivePrestationAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.archivePrestation(token, id);
  revalidatePath('/pro/prestations');
}

export async function restorePrestationAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.updatePrestation(token, id, { isActive: true });
  revalidatePath('/pro/prestations');
}

// ============================================
// Équipe
// ============================================

export async function createEmployeeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();
  const fullName = String(formData.get('fullName') ?? '').trim();

  if (fullName.length < 2) {
    return { error: fr.common.error };
  }

  try {
    await pro.createEmployee(token, { fullName });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/equipe');
  return { success: fr.pro.saved };
}

/**
 * Archivage d'un membre.
 *
 * Contrairement aux autres actions de liste, celle-ci peut échouer pour une
 * raison métier légitime — des rendez-vous à venir lui sont encore assignés.
 * Elle passe donc par `useActionState` pour pouvoir afficher ce refus, au lieu
 * d'échouer en silence.
 */
export async function archiveEmployeeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  try {
    await pro.archiveEmployee(token, id);
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/equipe');
  return { success: fr.pro.saved };
}

export async function restoreEmployeeAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.updateEmployee(token, id, { isActive: true });
  revalidatePath('/pro/equipe');
}

// ============================================
// Agenda
// ============================================

export async function setReservationStatusAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');

  if (
    status !== 'HONORED' &&
    status !== 'NO_SHOW' &&
    status !== 'CANCELED'
  ) {
    return;
  }

  await pro.updateReservationStatus(token, id, status);
  revalidatePath('/pro');
}

// ============================================
// Caisse (V4)
// ============================================

/**
 * Le gérant saisit des dinars, la base stocke des centimes entiers
 * (CLAUDE.md §3.5). La conversion se fait ici, une seule fois.
 */
function toCents(input: FormDataEntryValue | null): number | null {
  const dinars = Number(input);
  if (!Number.isFinite(dinars) || dinars <= 0) {
    return null;
  }
  return Math.round(dinars * 100);
}

export async function createCashMovementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const amountCents = toCents(formData.get('amountDinars'));
  const label = String(formData.get('label') ?? '').trim();
  const type = String(formData.get('type') ?? '');

  if (amountCents === null || label.length < 2) {
    return { error: fr.common.error };
  }

  if (type !== 'SALE' && type !== 'EXPENSE') {
    return { error: fr.common.error };
  }

  const method = String(formData.get('method') ?? 'CASH');

  try {
    await pro.createCashMovement(token, {
      type,
      amountCents,
      label,
      method:
        method === 'CARD' || method === 'TRANSFER' ? method : 'CASH',
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/caisse');
  return { success: fr.pro.saved };
}

/** Encaissement d'un rendez-vous déjà connu : aucun montant à ressaisir. */
export async function cashReservationAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();

  const reservationId = String(formData.get('reservationId') ?? '');
  const amountCents = Number(formData.get('amountCents'));
  const label = String(formData.get('label') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '');

  if (!reservationId || !Number.isInteger(amountCents) || amountCents <= 0) {
    return;
  }

  await pro.createCashMovement(token, {
    type: 'SALE',
    amountCents,
    label,
    reservationId,
    ...(employeeId && { employeeId }),
  });

  revalidatePath('/pro/caisse');
}

export async function deleteCashMovementAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.deleteCashMovement(token, id);
  revalidatePath('/pro/caisse');
}

// ============================================
// Stocks (V4)
// ============================================

export async function createProductAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) {
    return { error: fr.common.error };
  }

  const quantity = Number(formData.get('quantity'));
  const threshold = Number(formData.get('lowStockThreshold'));
  const cost = toCents(formData.get('costDinars'));

  try {
    await pro.createProduct(token, {
      name,
      unit: String(formData.get('unit') ?? '').trim() || undefined,
      ...(cost !== null && { costCents: cost }),
      quantity: Number.isInteger(quantity) && quantity >= 0 ? quantity : 0,
      lowStockThreshold:
        Number.isInteger(threshold) && threshold >= 0 ? threshold : 0,
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/stock');
  return { success: fr.pro.saved };
}

/**
 * Entrée ou sortie de stock.
 *
 * Passe par `useActionState` parce que le refus « stock négatif » est une
 * réponse métier légitime que le gérant doit lire, pas une erreur à avaler.
 */
export async function moveStockAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const productId = String(formData.get('productId') ?? '');
  const quantity = Number(formData.get('quantity'));
  const direction = String(formData.get('direction') ?? 'in');

  if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
    return { error: fr.common.error };
  }

  try {
    await pro.moveStock(token, productId, {
      delta: direction === 'out' ? -quantity : quantity,
      reason: String(formData.get('reason') ?? '').trim() || undefined,
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/stock');
  return { success: fr.pro.saved };
}

export async function archiveProductAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.archiveProduct(token, id);
  revalidatePath('/pro/stock');
}

// ============================================
// Indisponibilités
// ============================================

export async function createBlockedSlotAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await requireSessionToken();

  const date = String(formData.get('date') ?? '');
  const start = String(formData.get('start') ?? '');
  const end = String(formData.get('end') ?? '');
  const reason = String(formData.get('reason') ?? '');

  if (!date || !start || !end) {
    return { error: fr.common.error };
  }

  if (end <= start) {
    return { error: fr.pro.salon.invalidHours };
  }

  // Le gérant saisit des heures locales ; l'API attend de l'UTC. La
  // conversion passe par le même fuseau que le backend, sans offset en dur.
  const startsAt = localToUtcIso(date, start);
  const endsAt = localToUtcIso(date, end);

  try {
    await pro.createBlockedSlot(token, {
      startsAt,
      endsAt,
      reason: reason || undefined,
    });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/pro/indisponibilites');
  return { success: fr.pro.saved };
}

export async function deleteBlockedSlotAction(
  formData: FormData,
): Promise<void> {
  const token = await requireSessionToken();
  const id = String(formData.get('id') ?? '');

  await pro.deleteBlockedSlot(token, id);
  revalidatePath('/pro/indisponibilites');
}

/**
 * Heure murale d'Alger → instant UTC.
 * Même principe que `algiers-time.ts` côté backend : l'offset vient d'`Intl`
 * et non d'un `+1` codé en dur.
 */
function localToUtcIso(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Algiers',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(new Date(naive));
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const wallClockAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );

  const offsetMinutes = (wallClockAsUtc - naive) / 60_000;
  return new Date(naive - offsetMinutes * 60_000).toISOString();
}
