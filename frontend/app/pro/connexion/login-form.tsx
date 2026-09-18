'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '../actions';
import { fr } from '@/lib/i18n/fr';

const initialState: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action}>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">{fr.pro.phone}</span>
        <input
          type="tel"
          name="phone"
          inputMode="tel"
          autoComplete="username"
          required
          placeholder={fr.booking.phonePlaceholder}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.password}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

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
        {pending ? fr.pro.signingIn : fr.pro.signIn}
      </button>
    </form>
  );
}
