'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { registerAction, type ActionState } from '../actions';

const initialState: ActionState = {};

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent';

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <form action={action}>
      <fieldset className="mb-6">
        <legend className="mb-3 font-semibold">
          {fr.pro.register.yourAccount}
        </legend>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.fullName}
          </span>
          <input
            type="text"
            name="fullName"
            required
            maxLength={80}
            autoComplete="name"
            className={FIELD}
          />
        </label>

        <label className="mb-1 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.loginPhone}
          </span>
          <input
            type="tel"
            name="phone"
            inputMode="tel"
            required
            autoComplete="username"
            placeholder={fr.booking.phonePlaceholder}
            className={FIELD}
          />
        </label>
        <p className="mb-4 text-sm text-muted">
          {fr.pro.register.loginPhoneHelp}
        </p>

        <label className="mb-1 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.password}
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={FIELD}
          />
        </label>
        <p className="text-sm text-muted">{fr.pro.newPasswordHelp}</p>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-3 font-semibold">
          {fr.pro.register.yourSalon}
        </legend>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.salonName}
          </span>
          <input
            type="text"
            name="salonName"
            required
            maxLength={80}
            className={FIELD}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.addressLine}
          </span>
          <input
            type="text"
            name="addressLine"
            required
            maxLength={200}
            className={FIELD}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.district}
          </span>
          <input
            type="text"
            name="district"
            required
            maxLength={80}
            className={FIELD}
          />
        </label>

        <label className="mb-1 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.register.contactPhone}
          </span>
          <input
            type="tel"
            name="contactPhone"
            inputMode="tel"
            required
            placeholder={fr.booking.phonePlaceholder}
            className={FIELD}
          />
        </label>
        <p className="mb-4 text-sm text-muted">
          {fr.pro.register.contactPhoneHelp}
        </p>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="isWomenOnly" className="size-4" />
          <span className="text-sm">{fr.pro.register.womenOnly}</span>
        </label>
      </fieldset>

      {/* Honeypot — voir docs/SECURITY.md §1.1 */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

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
        {pending ? fr.pro.register.submitting : fr.pro.register.submit}
      </button>
    </form>
  );
}
