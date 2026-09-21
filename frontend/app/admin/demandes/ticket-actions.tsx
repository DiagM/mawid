'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import {
  setTicketStatusAction,
  setTicketNoteAction,
  type AdminActionState,
} from '../actions';

const EMPTY: AdminActionState = {};

const NEXT_STATUS = [
  { value: 'IN_PROGRESS', label: fr.admin.tickets.markInProgress },
  { value: 'CLOSED', label: fr.admin.tickets.markClosed },
  { value: 'OPEN', label: fr.admin.tickets.markOpen },
];

/**
 * Traitement d'une demande : statut et note interne.
 *
 * La note n'est jamais renvoyée à l'auteur — aucune route publique ne lit un
 * ticket. Elle sert à se souvenir de ce qui a été dit six mois plus tard.
 */
export function TicketActions({
  id,
  status,
  internalNote,
}: {
  id: string;
  status: string;
  internalNote: string | null;
}) {
  const [noteState, noteAction, noteSaving] = useActionState(
    setTicketNoteAction,
    EMPTY,
  );

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        {NEXT_STATUS.filter((entry) => entry.value !== status).map((entry) => (
          <form key={entry.value} action={setTicketStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={entry.value} />
            <button
              type="submit"
              className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
            >
              {entry.label}
            </button>
          </form>
        ))}
      </div>

      <form action={noteAction} className="mt-3">
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            {fr.admin.tickets.note}
          </span>
          <textarea
            name="internalNote"
            defaultValue={internalNote ?? ''}
            rows={2}
            maxLength={2000}
            placeholder={fr.admin.tickets.notePlaceholder}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
        </label>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={noteSaving}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
          >
            {fr.admin.tickets.saveNote}
          </button>
          {noteState.success && (
            <span className="text-sm text-accent">{noteState.success}</span>
          )}
          {noteState.error && (
            <span className="text-sm text-danger">{noteState.error}</span>
          )}
        </div>
      </form>
    </div>
  );
}
