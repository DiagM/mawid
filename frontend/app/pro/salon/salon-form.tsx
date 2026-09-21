'use client';

import { useActionState } from 'react';
import type { ManagedSalon } from '@/lib/api-pro';
import { fr, type WeekdayKey } from '@/lib/i18n/fr';
import { updateSalonAction, type ActionState } from '../actions';

const WEEK_ORDER: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const initialState: ActionState = {};

export function SalonForm({ salon }: { salon: ManagedSalon }) {
  const [state, action, pending] = useActionState(
    updateSalonAction,
    initialState,
  );

  const hasPosition = salon.latitude !== null && salon.longitude !== null;

  return (
    <form action={action}>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.salon.name}
        </span>
        <input
          type="text"
          name="name"
          defaultValue={salon.name}
          required
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.salon.description}
        </span>
        <textarea
          name="description"
          defaultValue={salon.description ?? ''}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.salon.addressLine}
        </span>
        <input
          type="text"
          name="addressLine"
          defaultValue={salon.addressLine}
          required
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.salon.district}
        </span>
        <input
          type="text"
          name="district"
          defaultValue={salon.district}
          required
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mb-2 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.salon.mapsUrl}
        </span>
        <input
          type="text"
          name="mapsUrl"
          placeholder={fr.pro.salon.mapsUrlPlaceholder}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
        <span className="mt-1 block text-xs text-muted">
          {fr.pro.salon.mapsUrlHelp}
        </span>
      </label>

      {/*
        Le champ reste VIDE meme quand une position existe : on stocke des
        coordonnees, pas le lien d'origine, donc rien de fidele a reafficher.
        D'ou ce temoin, et surtout la case a cocher plus bas — sans elle, un
        gerant qui enregistre ses horaires effacerait sa position au passage,
        sans rien remarquer.
      */}
      <p className="mb-4 text-sm">
        {hasPosition ? (
          <span className="font-medium text-accent">
            {fr.pro.salon.mapsUrlSet}
          </span>
        ) : (
          <span className="text-muted">{fr.pro.salon.mapsUrlNone}</span>
        )}
      </p>

      {hasPosition && (
        <label className="mb-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="removePosition"
            value="true"
            className="size-4"
          />
          <span>{fr.pro.salon.mapsUrlRemove}</span>
        </label>
      )}

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium">
          {fr.pro.salon.hours}
        </legend>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {WEEK_ORDER.map((day) => {
            const hours = salon.openingHours?.[day] ?? null;

            return (
              <div
                key={day}
                className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-b-0"
              >
                <label className="flex min-w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    name={`${day}-open`}
                    defaultChecked={hours !== null}
                    className="size-4"
                  />
                  <span className="text-sm">{fr.weekdays[day]}</span>
                </label>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">{fr.pro.salon.from}</span>
                  <input
                    type="time"
                    name={`${day}-from`}
                    defaultValue={hours?.open ?? '09:00'}
                    className="h-10 rounded-lg border border-border bg-background px-2"
                  />
                  <span className="text-muted">{fr.pro.salon.to}</span>
                  <input
                    type="time"
                    name={`${day}-to`}
                    defaultValue={hours?.close ?? '19:00'}
                    className="h-10 rounded-lg border border-border bg-background px-2"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

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
