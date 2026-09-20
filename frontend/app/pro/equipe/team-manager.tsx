'use client';

import { useActionState } from 'react';
import type { ManagedEmployee } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import {
  archiveEmployeeAction,
  createEmployeeAction,
  moveEmployeeAction,
  restoreEmployeeAction,
  type ActionState,
} from '../actions';
import { EmployeeHours } from './employee-hours';

const initialState: ActionState = {};

export function TeamManager({ employees }: { employees: ManagedEmployee[] }) {
  const [createState, createAction, creating] = useActionState(
    createEmployeeAction,
    initialState,
  );
  // L'archivage a son propre état : il peut être refusé pour une raison
  // métier légitime (des rendez-vous à venir restent assignés), et ce refus
  // doit être lisible plutôt que silencieux.
  const [archiveState, archiveAction] = useActionState(
    archiveEmployeeAction,
    initialState,
  );

  return (
    <>
      {employees.length === 0 ? (
        <p className="mb-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.team.empty}
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {employees.map((employee, index) => (
            <li
              key={employee.id}
              className={`rounded-xl border border-border bg-surface p-4 ${
                employee.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{employee.fullName}</p>
                  {!employee.isActive && (
                    <p className="text-sm text-muted">{fr.pro.team.archived}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Ordre d'affichage dans le sélecteur « avec qui ? » vu
                      par le client. On remonte le membre d'un cran ;
                      le serveur renumérote toute la liste. */}
                  {employee.isActive && index > 0 && (
                    <form action={moveEmployeeAction}>
                      <input type="hidden" name="id" value={employee.id} />
                      <button
                        type="submit"
                        aria-label={fr.pro.team.moveUp}
                        className="h-10 w-10 rounded-xl border border-border text-sm"
                      >
                        ↑
                      </button>
                    </form>
                  )}

                  {employee.isActive ? (
                    <form action={archiveAction}>
                      <input type="hidden" name="id" value={employee.id} />
                      <button
                        type="submit"
                        className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
                      >
                        {fr.pro.team.archive}
                      </button>
                    </form>
                  ) : (
                    <form action={restoreEmployeeAction}>
                      <input type="hidden" name="id" value={employee.id} />
                      <button
                        type="submit"
                        className="h-10 rounded-xl border border-accent px-4 text-sm font-medium text-accent"
                      >
                        {fr.pro.team.restore}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {employee.isActive && <EmployeeHours employee={employee} />}
            </li>
          ))}
        </ul>
      )}

      {archiveState.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {archiveState.error}
        </p>
      )}

      <p className="mb-6 text-sm text-muted">{fr.pro.team.archiveHelp}</p>

      <form
        action={createAction}
        className="rounded-xl border border-border bg-surface p-4"
      >
        <h2 className="mb-4 font-semibold">{fr.pro.team.add}</h2>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.team.fullName}
          </span>
          <input
            type="text"
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
          />
        </label>

        {createState.error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
          >
            {createState.error}
          </p>
        )}
        {createState.success && (
          <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">
            {createState.success}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {creating ? fr.pro.saving : fr.pro.save}
        </button>
      </form>
    </>
  );
}
