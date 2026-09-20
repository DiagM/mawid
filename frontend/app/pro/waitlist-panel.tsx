import type { WaitlistEntry } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPhone } from '@/lib/format';
import {
  removeWaitlistEntryAction,
  setWaitlistNotifiedAction,
} from './actions';

/**
 * Clientes en attente pour la journée affichée.
 *
 * Mawid n'envoie rien : une notification automatique se facturerait au
 * message. Le lien `wa.me` est donc préparé, le gérant écrit depuis son
 * propre numéro — ce qui donne au message une chance d'être lu — et marque
 * ensuite la demande comme traitée.
 *
 * L'ordre d'arrivée fait foi et vient du serveur : c'est la seule règle
 * équitable, et la seule que le gérant pourra justifier à une cliente.
 */
export function WaitlistPanel({
  entries,
  salonName,
}: {
  entries: WaitlistEntry[];
  salonName: string;
}) {
  if (entries.length === 0) {
    return null;
  }

  const pending = entries.filter((entry) => entry.notifiedAt === null).length;

  return (
    <section className="mb-6 rounded-xl border border-accent bg-surface p-4">
      <h2 className="font-semibold">
        {fr.pro.waitlist.title.replace('{count}', String(entries.length))}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {pending > 0
          ? fr.pro.waitlist.help.replace('{pending}', String(pending))
          : fr.pro.waitlist.allDone}
      </p>

      <ul className="mt-4 space-y-3">
        {entries.map((entry, index) => {
          const isDone = entry.notifiedAt !== null;
          const message = fr.pro.waitlist.message
            .replace('{firstName}', entry.clientFirstName)
            .replace('{salon}', salonName);

          return (
            <li
              key={entry.id}
              className={`rounded-xl border border-border p-3 ${
                isDone ? 'opacity-60' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {index + 1}. {entry.clientFirstName}
                  </p>
                  <p className="text-sm text-muted">
                    {formatPhone(entry.clientPhone)}
                  </p>
                  <p className="text-sm text-muted">
                    {entry.prestationsSummary} ·{' '}
                    {fr.pro.waitlist.duration.replace(
                      '{minutes}',
                      String(entry.durationMinutes),
                    )}
                  </p>
                  {entry.note && (
                    <p className="mt-1 text-sm">« {entry.note} »</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {isDone ? (
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                      {fr.pro.waitlist.contacted}
                    </span>
                  ) : (
                    <a
                      href={`https://wa.me/${entry.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                    >
                      {fr.pro.waitlist.contact}
                    </a>
                  )}

                  <div className="flex gap-2 text-sm">
                    <form action={setWaitlistNotifiedAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input
                        type="hidden"
                        name="notified"
                        value={String(!isDone)}
                      />
                      <button
                        type="submit"
                        className="text-muted underline underline-offset-4"
                      >
                        {isDone
                          ? fr.pro.waitlist.markPending
                          : fr.pro.waitlist.markContacted}
                      </button>
                    </form>

                    <form action={removeWaitlistEntryAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="text-danger underline underline-offset-4"
                      >
                        {fr.pro.waitlist.remove}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        {fr.pro.waitlist.noAutoMessage}
      </p>
    </section>
  );
}
