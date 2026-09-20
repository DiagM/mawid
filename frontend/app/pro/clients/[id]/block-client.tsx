'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { setClientBlockedAction, type ActionState } from '../../actions';

const initialState: ActionState = {};

/**
 * Blocage d'une cliente dans ce salon.
 *
 * Le motif est demandé à l'activation seulement : six mois plus tard, un
 * gérant qui retrouve une cliente bloquée sans savoir pourquoi la débloque
 * par défaut, ce qui annule l'intérêt du dispositif.
 *
 * La cliente n'est jamais informée, et son refus de réservation reste un
 * message neutre — lui confirmer qu'elle est bloquée lui apprendrait
 * seulement à changer de numéro.
 */
export function BlockClient({
  clientId,
  isBlockedHere,
  blockReason,
}: {
  clientId: string;
  isBlockedHere: boolean;
  blockReason: string | null;
}) {
  const [state, action, pending] = useActionState(
    setClientBlockedAction,
    initialState,
  );

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">
        {isBlockedHere ? fr.pro.clients.blockedHere : fr.pro.clients.blockTitle}
      </h2>
      <p className="mt-1 text-sm text-muted">{fr.pro.clients.blockHelp}</p>

      {isBlockedHere && blockReason && (
        <p className="mt-2 rounded-lg bg-background p-3 text-sm">
          {blockReason}
        </p>
      )}

      <form action={action} className="mt-4">
        <input type="hidden" name="clientId" value={clientId} />
        <input
          type="hidden"
          name="isBlocked"
          value={String(!isBlockedHere)}
        />

        {!isBlockedHere && (
          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.clients.blockReason}
            </span>
            <input
              type="text"
              name="reason"
              maxLength={200}
              placeholder={fr.pro.clients.blockReasonPlaceholder}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
            />
          </label>
        )}

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
          className={`h-11 rounded-xl px-5 text-sm font-medium disabled:opacity-60 ${
            isBlockedHere
              ? 'border border-accent text-accent'
              : 'border border-danger text-danger'
          }`}
        >
          {isBlockedHere ? fr.pro.clients.unblock : fr.pro.clients.block}
        </button>
      </form>
    </section>
  );
}
