'use client';

import { useActionState } from 'react';
import { changePasswordAction, type ActionState } from '../actions';
import { fr } from '@/lib/i18n/fr';

const initialState: ActionState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <form action={action}>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.currentPassword}
        </span>
        <input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-2 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.newPassword}
        </span>
        <input
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>
      <p className="mb-6 text-sm text-muted">{fr.pro.newPasswordHelp}</p>

      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? fr.pro.saving : fr.pro.save}
      </button>
    </form>
  );
}
