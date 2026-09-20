'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import {
  resetPasswordAction,
  setFeaturedAction,
  setSalonPlanAction,
  type AdminActionState,
} from './actions';

const EMPTY: AdminActionState = {};

const PLANS = ['FREE', 'PRO', 'PRO_PLUS'] as const;

/**
 * Les trois gestes commerciaux d'un salon : offre, mise en avant, et
 * dépannage de mot de passe.
 *
 * Composant client parce que chacun renvoie un message — le mot de passe
 * régénéré en particulier, qui n'est affiché qu'ici et jamais relisible.
 */
export function SalonCommercialForm({
  salonId,
  userId,
  plan,
}: {
  salonId: string;
  userId: string;
  plan: string;
}) {
  const [planState, planAction, planPending] = useActionState(
    setSalonPlanAction,
    EMPTY,
  );
  const [featuredState, featuredAction, featuredPending] = useActionState(
    setFeaturedAction,
    EMPTY,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    EMPTY,
  );

  const message =
    planState.error ??
    featuredState.error ??
    resetState.error ??
    planState.success ??
    featuredState.success ??
    resetState.success;

  const isError = Boolean(
    planState.error ?? featuredState.error ?? resetState.error,
  );

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <form action={planAction} className="flex items-end gap-2">
          <input type="hidden" name="salonId" value={salonId} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">{fr.admin.salons.plan}</span>
            <select
              name="plan"
              defaultValue={plan}
              className="rounded-lg border border-border bg-surface px-2 py-1.5"
            >
              {PLANS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={planPending}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
          >
            {fr.admin.salons.apply}
          </button>
        </form>

        <form action={featuredAction} className="flex items-end gap-2">
          <input type="hidden" name="salonId" value={salonId} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              {fr.admin.salons.featureWeeks}
            </span>
            <input
              type="number"
              name="featuredWeeks"
              min={0}
              max={52}
              defaultValue={0}
              className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={featuredPending}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
          >
            {fr.admin.salons.apply}
          </button>
        </form>

        <form action={resetAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            disabled={resetPending}
            className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50"
          >
            {fr.admin.salons.resetPassword}
          </button>
        </form>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-2 text-sm ${isError ? 'text-danger' : 'text-muted'}`}
        >
          {message}
        </p>
      )}

      {resetState.password && (
        <GeneratedPassword
          phone={resetState.phone ?? ''}
          password={resetState.password}
        />
      )}
    </div>
  );
}

/**
 * Affichage unique d'un mot de passe généré.
 *
 * Il n'est stocké nulle part en clair : quitter cet écran sans le noter
 * oblige à en régénérer un autre. L'avertissement est donc explicite.
 */
export function GeneratedPassword({
  phone,
  password,
}: {
  phone: string;
  password: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-accent bg-bg p-3">
      <p className="text-sm font-medium">{fr.admin.managers.passwordTitle}</p>
      {phone && <p className="text-sm text-muted">{phone}</p>}
      <p className="my-2 select-all break-all font-mono text-lg">{password}</p>
      <p className="text-xs text-muted">
        {fr.admin.managers.passwordWarning}
      </p>
    </div>
  );
}
