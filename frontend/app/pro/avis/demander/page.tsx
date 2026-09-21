import type { Metadata } from 'next';
import Link from 'next/link';
import { getMySalon, getReviewRequests } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPhone } from '@/lib/format';
import { manageUrl } from '@/lib/booking-share';
import { getRequestOrigin } from '@/lib/request-origin';
import { requireSessionToken } from '@/lib/session';
import { setReviewRequestedAction } from '../../actions';

export const metadata: Metadata = { title: fr.pro.reviewRequests.title };

/**
 * Relance après visite.
 *
 * La notation existait déjà et ne servait à rien : une cliente ne retourne
 * pas d'elle-même sur un lien reçu trois jours plus tôt, et le seul message
 * du produit — le rappel — part AVANT la visite.
 *
 * Même mécanique que les rappels, pour la même raison : Mawid n'envoie rien.
 * Un message automatique se facturerait à l'unité, et un message venu du
 * numéro du salon a de toute façon plus de chances d'être lu.
 */
export default async function ReviewRequestsPage() {
  const token = await requireSessionToken();

  const [requests, salon, origin] = await Promise.all([
    getReviewRequests(token),
    getMySalon(token),
    getRequestOrigin(),
  ]);

  const done = requests.items.filter(
    (item) => item.reviewRequestedAt !== null,
  ).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">
        {fr.pro.reviewRequests.title}
      </h1>
      <p className="mb-4 text-sm text-muted">{fr.pro.reviewRequests.help}</p>

      <p className="mb-6 text-sm text-muted">
        {fr.pro.reviewRequests.window.replace(
          '{days}',
          String(requests.windowDays),
        )}
      </p>

      {requests.items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.reviewRequests.empty}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {fr.pro.reviewRequests.progress
              .replace('{done}', String(done))
              .replace('{total}', String(requests.items.length))}
          </p>

          <ul className="space-y-2">
            {requests.items.map((item) => {
              const isDone = item.reviewRequestedAt !== null;
              const message = fr.pro.reviewRequests.message
                .replace('{firstName}', item.clientFirstName)
                .replace('{salon}', salon.name)
                .replace('{link}', manageUrl(item.cancellationToken, origin));

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border border-border bg-surface p-4 ${
                    isDone ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.clientFirstName}</p>
                      <p className="text-sm text-muted">
                        {formatPhone(item.clientPhone)}
                      </p>
                      <p className="text-sm text-muted">
                        {item.localDate} · {item.localTime} · {item.prestations}
                        {item.employeeName && ` · ${item.employeeName}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {isDone ? (
                        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                          {fr.pro.reviewRequests.sent}
                        </span>
                      ) : (
                        <a
                          href={`https://wa.me/${item.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                        >
                          {fr.pro.reviewRequests.send}
                        </a>
                      )}

                      <form action={setReviewRequestedAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="requested"
                          value={String(!isDone)}
                        />
                        <button
                          type="submit"
                          className="text-sm text-muted underline underline-offset-4"
                        >
                          {isDone
                            ? fr.pro.reviewRequests.markPending
                            : fr.pro.reviewRequests.markSent}
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-muted">
            {fr.pro.reviewRequests.linkHelp}
          </p>
        </>
      )}

      <p className="mt-6 rounded-xl border border-border bg-background p-4 text-xs text-muted">
        {fr.pro.reviewRequests.onlyHonored}
      </p>

      <Link
        href="/pro/avis"
        className="mt-6 inline-block text-sm text-muted underline underline-offset-4"
      >
        {fr.common.back}
      </Link>
    </main>
  );
}
