'use client';

import { useActionState, useState } from 'react';
import { fr } from '@/lib/i18n/fr';
import type { ManagedEmployee } from '@/lib/api-pro';
import { createBlockedSlotAction, type ActionState } from '../actions';

const initialState: ActionState = {};

type Mode = 'hours' | 'days';

/**
 * Déclaration d'une indisponibilité.
 *
 * Deux formes pour une même notion, et les séparer compte : une pause de
 * midi et un congé d'été ne se saisissent pas de la même façon. Le formulaire
 * d'origine n'acceptait qu'une date unique, ce qui rendait les vacances
 * impossibles à déclarer alors que le serveur les acceptait déjà.
 *
 * ⚠️ Ce formulaire ne gère **pas** les jours de congé hebdomadaires : un
 * membre qui ne travaille jamais le lundi se règle une fois pour toutes dans
 * ses horaires, sur la page Équipe. Le dire ici évite qu'un gérant saisisse
 * cinquante-deux absences pour un seul jour off.
 */
export function BlockedForm({
  today,
  employees,
}: {
  today: string;
  employees: ManagedEmployee[];
}) {
  const [state, action, pending] = useActionState(
    createBlockedSlotAction,
    initialState,
  );
  const [mode, setMode] = useState<Mode>('hours');

  const modes: { value: Mode; label: string }[] = [
    { value: 'hours', label: fr.pro.blocked.modeHours },
    { value: 'days', label: fr.pro.blocked.modeDays },
  ];

  return (
    <form
      action={action}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="mb-1 font-semibold">{fr.pro.blocked.add}</h2>
      <p className="mb-4 text-sm text-muted">{fr.pro.blocked.recurringHint}</p>

      <input type="hidden" name="mode" value={mode} />

      <div className="mb-4 flex flex-wrap gap-2">
        {modes.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setMode(entry.value)}
            aria-pressed={mode === entry.value}
            className={`h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
              mode === entry.value
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-background'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {employees.length > 0 && (
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.blocked.who}
          </span>
          <select
            name="employeeId"
            defaultValue=""
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          >
            <option value="">{fr.pro.blocked.wholeSalon}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            {fr.pro.blocked.whoHelp}
          </span>
        </label>
      )}

      {mode === 'hours' ? (
        <>
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
        </>
      ) : (
        <div className="mb-4 flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.blocked.from}
            </span>
            <input
              type="date"
              name="from"
              required
              defaultValue={today}
              min={today}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
            />
          </label>

          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.blocked.to}
            </span>
            <input
              type="date"
              name="to"
              required
              defaultValue={today}
              min={today}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
            />
          </label>
        </div>
      )}

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.blocked.reason}
        </span>
        <input
          type="text"
          name="reason"
          maxLength={200}
          placeholder={
            mode === 'days'
              ? fr.pro.blocked.reasonDaysPlaceholder
              : fr.pro.blocked.reasonPlaceholder
          }
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
