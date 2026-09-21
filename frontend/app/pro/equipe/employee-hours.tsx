'use client';

import { useActionState, useState } from 'react';
import type { ManagedEmployee } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { updateEmployeeHoursAction, type ActionState } from '../actions';

const initialState: ActionState = {};

const WEEK_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/**
 * Horaires individuels d'un membre.
 *
 * Replié par défaut : un salon de cinq personnes afficherait sinon trente-cinq
 * lignes d'horaires d'un coup, alors que la plupart des membres suivent
 * simplement ceux du salon.
 *
 * La distinction qui compte, et que l'interface doit rendre évidente :
 * « suit les horaires du salon » (`null`) n'est pas « fermé tous les jours ».
 * La première fait suivre le salon, la seconde rend le membre indisponible en
 * permanence et ne lui donne plus aucun créneau.
 */
export function EmployeeHours({ employee }: { employee: ManagedEmployee }) {
  const [state, action, pending] = useActionState(
    updateEmployeeHoursAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [followsSalon, setFollowsSalon] = useState(
    employee.workingHours === null,
  );

  const summary =
    employee.workingHours === null
      ? fr.pro.team.followsSalon
      : fr.pro.team.customHours;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm"
      >
        <span className="text-muted">
          {fr.pro.team.hours} · {summary}
        </span>
        <span aria-hidden className="text-muted">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <form action={action} className="mt-3">
          <input type="hidden" name="id" value={employee.id} />

          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="followsSalon"
              checked={followsSalon}
              onChange={(event) => setFollowsSalon(event.target.checked)}
              className="size-4"
            />
            {fr.pro.team.followsSalon}
          </label>

          {!followsSalon && (
            <div className="mb-3 overflow-hidden rounded-xl border border-border">
              {WEEK_ORDER.map((day) => {
                const hours = employee.workingHours?.[day] ?? null;

                return (
                  <div
                    key={day}
                    className="flex flex-wrap items-center gap-3 border-b border-border p-2 last:border-b-0"
                  >
                    <label className="flex min-w-28 items-center gap-2">
                      <input
                        type="checkbox"
                        name={`${employee.id}-${day}-open`}
                        defaultChecked={hours !== null}
                        className="size-4"
                      />
                      <span className="text-sm">{fr.weekdays[day]}</span>
                    </label>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted">{fr.pro.salon.from}</span>
                      <input
                        type="time"
                        name={`${employee.id}-${day}-from`}
                        defaultValue={hours?.open ?? '09:00'}
                        className="h-9 rounded-lg border border-border bg-background px-2"
                      />
                      <span className="text-muted">{fr.pro.salon.to}</span>
                      <input
                        type="time"
                        name={`${employee.id}-${day}-to`}
                        defaultValue={hours?.close ?? '19:00'}
                        className="h-9 rounded-lg border border-border bg-background px-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mb-1 text-xs text-muted">{fr.pro.team.hoursHelp}</p>
          <p className="mb-3 text-xs text-muted">{fr.pro.team.dayOffHint}</p>

          {state.error && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="mb-3 text-sm text-accent">{state.success}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
          >
            {pending ? fr.pro.saving : fr.pro.save}
          </button>
        </form>
      )}
    </div>
  );
}
