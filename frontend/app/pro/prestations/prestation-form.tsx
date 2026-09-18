'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { createPrestationAction, type ActionState } from '../actions';

const initialState: ActionState = {};

export function PrestationForm() {
  const [state, action, pending] = useActionState(
    createPrestationAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-semibold">{fr.pro.prestations.add}</h2>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.prestations.name}
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={100}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.prestations.description}
        </span>
        <input
          type="text"
          name="description"
          maxLength={200}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <div className="mb-4 flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.prestations.duration}
          </span>
          <input
            type="number"
            name="durationMinutes"
            required
            min={5}
            max={480}
            step={5}
            defaultValue={30}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          />
        </label>

        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.prestations.price}
          </span>
          {/*
            Le gérant saisit des dinars ; la conversion en centimes entiers se
            fait dans la Server Action (CLAUDE.md §3.5).
          */}
          <input
            type="number"
            name="priceDinars"
            required
            min={0}
            step={50}
            defaultValue={1000}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          />
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
