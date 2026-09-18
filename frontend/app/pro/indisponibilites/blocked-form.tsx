'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { createBlockedSlotAction, type ActionState } from '../actions';

const initialState: ActionState = {};

export function BlockedForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(
    createBlockedSlotAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-semibold">{fr.pro.blocked.add}</h2>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.blocked.date}
        </span>
        <input
          type="date"
          name="date"
          required
          defaultValue={today}
          min={today}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <div className="mb-4 flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.blocked.start}
          </span>
          <input
            type="time"
            name="start"
            required
            defaultValue="12:00"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          />
        </label>

        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.blocked.end}
          </span>
          <input
            type="time"
            name="end"
            required
            defaultValue="13:00"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.blocked.reason}
        </span>
        <input
          type="text"
          name="reason"
          maxLength={200}
          placeholder={fr.pro.blocked.reasonPlaceholder}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
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
      {state.success && (
        <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {state.success}
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
