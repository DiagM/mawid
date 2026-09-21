'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';
import * as admin from '@/lib/api-admin';
import { fr } from '@/lib/i18n/fr';
import { toE164 } from '@/lib/format';
import { requireAdminToken } from '@/lib/session';

/**
 * ============================================
 * Server Actions de la console d'administration
 * ============================================
 * ⚠️ Comme celles du back-office gérant, ces actions sont joignables par un
 * POST direct. Chacune revérifie donc le rôle par `requireAdminToken()` — et
 * le backend refait le contrôle de son côté. Deux barrières, parce que celle
 * qui saute est toujours celle qu'on croyait inutile.
 */

export interface AdminActionState {
  error?: string;
  success?: string;
  /** Mot de passe généré, affiché une seule fois puis perdu. */
  password?: string;
  phone?: string;
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return fr.common.networkError;
    }
    if (error.status === 403) {
      return fr.admin.forbidden;
    }
    return error.message;
  }
  return fallback;
}

// ============================================
// Salons
// ============================================

export async function setSalonActiveAction(formData: FormData): Promise<void> {
  const token = await requireAdminToken();
  const salonId = String(formData.get('salonId') ?? '');
  const isActive = String(formData.get('isActive') ?? '') === 'true';

  await admin.updateSalon(token, salonId, { isActive });
  revalidatePath('/admin');
}

export async function setSalonPlanAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const token = await requireAdminToken();
  const salonId = String(formData.get('salonId') ?? '');
  const plan = String(formData.get('plan') ?? '');

  try {
    await admin.updateSalon(token, salonId, { plan });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/admin');
  return { success: fr.admin.saved };
}

export async function setFeaturedAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const token = await requireAdminToken();
  const salonId = String(formData.get('salonId') ?? '');
  const weeks = Number(formData.get('featuredWeeks') ?? 0);

  if (!Number.isInteger(weeks) || weeks < 0 || weeks > 52) {
    return { error: fr.admin.featuredInvalid };
  }

  try {
    await admin.updateSalon(token, salonId, { featuredWeeks: weeks });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/admin');
  return { success: fr.admin.saved };
}

// ============================================
// Gérants
// ============================================

export async function createManagerAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const token = await requireAdminToken();

  const phone = toE164(String(formData.get('phone') ?? ''));
  const contactPhone = toE164(String(formData.get('contactPhone') ?? ''));

  // Normalisé ici plutôt que laissé au backend : un numéro mal formé
  // remonterait sinon en 400 générique, sans dire lequel des deux champs est
  // en cause.
  if (!phone || !contactPhone) {
    return { error: fr.admin.managers.invalidPhone };
  }

  try {
    const created = await admin.createManager(token, {
      phone,
      fullName: String(formData.get('fullName') ?? '').trim(),
      salonName: String(formData.get('salonName') ?? '').trim(),
      addressLine: String(formData.get('addressLine') ?? '').trim(),
      district: String(formData.get('district') ?? '').trim(),
      city: String(formData.get('city') ?? 'Alger'),
      contactPhone,
      isWomenOnly: formData.get('isWomenOnly') === 'on',
    });

    revalidatePath('/admin');
    revalidatePath('/admin/gerants');

    return {
      success: fr.admin.managers.created.replace('{slug}', created.salon.slug),
      // Le mot de passe remonte dans l'état de l'action : c'est la seule
      // occasion de le lire, il n'est stocké nulle part en clair.
      password: created.password,
      phone: created.user.phone,
    };
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }
}

export async function resetPasswordAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const token = await requireAdminToken();
  const userId = String(formData.get('userId') ?? '');

  try {
    const result = await admin.resetManagerPassword(token, userId);

    revalidatePath('/admin');
    return {
      success: fr.admin.managers.passwordReset,
      password: result.password,
      phone: result.phone,
    };
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }
}

// ============================================
// Modération
// ============================================

export async function moderateReviewAction(
  formData: FormData,
): Promise<void> {
  const token = await requireAdminToken();
  const reviewId = String(formData.get('reviewId') ?? '');
  const isPublished = String(formData.get('isPublished') ?? '') === 'true';

  await admin.moderateReview(token, reviewId, isPublished);
  revalidatePath('/admin/avis');
}

// ============================================
// Demandes des salons
// ============================================

export async function setTicketStatusAction(
  formData: FormData,
): Promise<void> {
  const token = await requireAdminToken();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');

  await admin.updateTicket(token, id, { status });
  revalidatePath('/admin/demandes');
}

export async function setTicketNoteAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const token = await requireAdminToken();
  const id = String(formData.get('id') ?? '');
  const internalNote = String(formData.get('internalNote') ?? '');

  try {
    await admin.updateTicket(token, id, { internalNote });
  } catch (error) {
    return { error: toMessage(error, fr.common.error) };
  }

  revalidatePath('/admin/demandes');
  return { success: fr.admin.saved };
}
