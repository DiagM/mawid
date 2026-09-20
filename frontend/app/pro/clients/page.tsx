import type { Metadata } from 'next';
import Link from 'next/link';
import { getClients } from '@/lib/api-pro';
import { ApiError } from '@/lib/api';
import { PlanLocked } from '../plan-locked';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, formatPhone, formatPrice } from '@/lib/format';
import { requireSessionToken } from '@/lib/session';

export const metadata: Metadata = { title: fr.pro.clients.title };

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function ClientsPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  let clients;
  try {
    clients = await getClients(token, { query: query || undefined });
  } catch (error) {
    // Module hors offre : on présente ce qu'il apporte plutôt qu'une erreur.
    if (error instanceof ApiError && error.status === 403) {
      return <PlanLocked module="clients" />;
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{fr.pro.clients.title}</h1>

      {/*
        Formulaire en GET : une recherche doit produire une URL rechargeable,
        et c'est une lecture, pas une mutation.
      */}
      <form method="get" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={fr.pro.clients.searchPlaceholder}
          aria-label={fr.pro.clients.search}
          className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-accent px-5 font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {fr.search.submit}
        </button>
      </form>

      {clients.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">
            {query ? fr.pro.clients.noResult : fr.pro.clients.empty}
          </p>
          {!query && (
            <p className="mt-1 text-sm text-muted">
              {fr.pro.clients.emptyHelp}
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {clients.items.map((client) => (
            <li key={client.id}>
              <Link
                href={`/pro/clients/${client.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {client.firstName}
                      {client.isBlocked && (
                        <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                          {fr.pro.clients.blocked}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatPhone(client.phone)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-accent">
                      {formatPrice(client.totalSpentCents)}
                    </p>
                    <p className="text-sm text-muted">
                      {client.visits}{' '}
                      {client.visits > 1
                        ? fr.pro.clients.visitsPlural
                        : fr.pro.clients.visits}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted">
                  {client.lastVisit ? (
                    <>
                      {fr.pro.clients.lastVisit} :{' '}
                      <span className="capitalize">
                        {formatLongDate(client.lastVisit)}
                      </span>
                    </>
                  ) : (
                    fr.pro.clients.never
                  )}
                  {client.noShows > 0 && (
                    <span className="text-danger">
                      {' · '}
                      {client.noShows}{' '}
                      {client.noShows > 1
                        ? fr.pro.clients.noShowsPlural
                        : fr.pro.clients.noShows}
                    </span>
                  )}
                </p>

                {client.nextVisit && (
                  <p className="mt-1 text-sm text-accent">
                    {fr.pro.clients.nextVisit} :{' '}
                    <span className="capitalize">
                      {formatLongDate(client.nextVisit)}
                    </span>
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
