import type { Metadata } from 'next';
import Link from 'next/link';
import { getTickets } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatInstantDate, formatPhone } from '@/lib/format';
import { requireAdminToken } from '@/lib/session';
import { TicketActions } from './ticket-actions';

export const metadata: Metadata = { title: fr.admin.tickets.title };

type PageProps = { searchParams: Promise<{ status?: string }> };

const FILTERS = [
  { value: 'OPEN', label: fr.admin.tickets.filterOpen },
  { value: 'IN_PROGRESS', label: fr.admin.tickets.filterInProgress },
  { value: 'CLOSED', label: fr.admin.tickets.filterClosed },
  { value: 'ALL', label: fr.admin.tickets.filterAll },
];

const KIND_LABELS: Record<string, string> = {
  UPGRADE: fr.admin.tickets.kindUpgrade,
  ISSUE: fr.admin.tickets.kindIssue,
  OTHER: fr.admin.tickets.kindOther,
};

/**
 * File de traitement des demandes.
 *
 * Ouvertes d'abord : c'est l'ordre dans lequel on traite un support. Une
 * demande de changement d'offre affiche l'offre actuelle du salon à côté de
 * celle demandée — c'est la première chose à vérifier avant de répondre.
 */
export default async function AdminTicketsPage({ searchParams }: PageProps) {
  const token = await requireAdminToken();
  const params = await searchParams;

  const status = FILTERS.some((filter) => filter.value === params.status)
    ? params.status!
    : 'OPEN';

  const tickets = await getTickets(token, status);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold rule-gold">
        {fr.admin.tickets.title}
      </h1>
      <p className="mb-6 text-sm text-muted">{fr.admin.tickets.help}</p>

      <nav className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/demandes?status=${filter.value}`}
            aria-current={filter.value === status ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter.value === status
                ? 'bg-accent text-white'
                : 'border border-border text-muted'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.admin.tickets.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className={`rounded-xl border bg-surface p-4 ${
                ticket.status === 'OPEN' ? 'border-accent' : 'border-border'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {KIND_LABELS[ticket.kind]}
                  </p>
                  <h2 className="font-display text-lg">{ticket.subject}</h2>

                  <p className="mt-1 text-sm text-muted">
                    {ticket.contactName} · {formatPhone(ticket.contactPhone)}
                    {ticket.contactEmail && ` · ${ticket.contactEmail}`}
                  </p>

                  <p className="text-sm text-muted">
                    {ticket.salon ? (
                      <>
                        <Link
                          href={`/${ticket.salon.slug}`}
                          className="text-accent underline"
                        >
                          {ticket.salon.name}
                        </Link>{' '}
                        · {fr.admin.tickets.currentPlan} {ticket.salon.plan}
                      </>
                    ) : (
                      fr.admin.tickets.noSalon
                    )}
                    {ticket.requestedPlan && (
                      <>
                        {' → '}
                        <strong className="text-foreground">
                          {ticket.requestedPlan}
                        </strong>
                      </>
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-xs text-muted">
                  {formatInstantDate(ticket.createdAt)}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line rounded-lg bg-background p-3 text-sm">
                {ticket.message}
              </p>

              <TicketActions
                id={ticket.id}
                status={ticket.status}
                internalNote={ticket.internalNote}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
