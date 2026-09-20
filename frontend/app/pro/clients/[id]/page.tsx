import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import { getClient, type ClientDetail } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { BlockClient } from './block-client';
import { formatLongDate, formatPhone, formatPrice } from '@/lib/format';
import { requireSessionToken } from '@/lib/session';

export const metadata: Metadata = { title: fr.pro.clients.title };

type PageProps = { params: Promise<{ id: string }> };

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-accent-soft text-accent',
  HONORED: 'bg-accent text-white',
  NO_SHOW: 'bg-danger-soft text-danger',
  CANCELED: 'bg-border text-muted',
};

/**
 * try/catch autour de la seule récupération de données, jamais du JSX
 * (règle react-hooks/error-boundaries).
 *
 * Un client d'un autre salon renvoie 404 côté API : on affiche donc le même
 * écran qu'un identifiant inexistant, sans révéler que le client existe
 * ailleurs.
 */
async function loadClient(
  token: string,
  id: string,
): Promise<ClientDetail | null> {
  try {
    return await getClient(token, id);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
}

export default async function ClientDetailPage({ params }: PageProps) {
  const token = await requireSessionToken();
  const { id } = await params;
  const client = await loadClient(token, id);

  if (!client) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">{fr.pro.clients.notFound}</h1>
        <Link
          href="/pro/clients"
          className="mt-4 inline-block text-accent underline underline-offset-4"
        >
          {fr.pro.clients.back}
        </Link>
      </main>
    );
  }

  const totalSpent = client.reservations
    .filter((reservation) => reservation.status === 'HONORED')
    .reduce((total, reservation) => total + reservation.totalPriceCents, 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        href="/pro/clients"
        className="mb-4 inline-block text-sm text-muted underline underline-offset-4"
      >
        ← {fr.pro.clients.back}
      </Link>

      <h1 className="text-xl font-semibold">{client.firstName}</h1>
      <p className="mt-1 text-muted">{formatPhone(client.phone)}</p>

      <div className="mt-4 flex gap-2">
        <a
          href={`tel:${client.phone}`}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface font-medium"
        >
          {fr.pro.clients.call}
        </a>
        {/*
          wa.me sans message pré-rempli : c'est le gérant qui écrit, on ne
          peut pas deviner ce qu'il a à dire à ce client précis.
        */}
        <a
          href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-accent font-semibold text-white"
        >
          {fr.pro.clients.whatsapp}
        </a>
      </div>

      <p className="mt-4 rounded-xl border border-border bg-surface p-4">
        <span className="text-muted">{fr.pro.clients.spent} : </span>
        <span className="font-semibold text-accent">
          {formatPrice(totalSpent)}
        </span>
      </p>

      <h2 className="mb-3 mt-6 text-lg font-semibold">
        {fr.pro.clients.history}
      </h2>

      <ul className="space-y-2">
        {client.reservations.map((reservation) => (
          <li
            key={reservation.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium capitalize">
                  {formatLongDate(reservation.localDate)}
                </p>
                {reservation.employeeName && (
                  <p className="text-sm text-muted">
                    {reservation.employeeName}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  STATUS_STYLES[reservation.status]
                }`}
              >
                {fr.manage.status[reservation.status]}
              </span>
            </div>

            <ul className="mt-2 text-sm text-muted">
              {reservation.prestations.map((line) => (
                <li key={line.name} className="flex justify-between gap-4">
                  <span>{line.name}</span>
                  <span>{formatPrice(line.priceCents)}</span>
                </li>
              ))}
            </ul>

            {reservation.internalNote && (
              <p className="mt-2 rounded-lg bg-background p-3 text-sm">
                {reservation.internalNote}
              </p>
            )}
          </li>
        ))}
      </ul>

      <BlockClient
        clientId={client.id}
        isBlockedHere={client.isBlockedHere}
        blockReason={client.blockReason}
      />
    </main>
  );
}
