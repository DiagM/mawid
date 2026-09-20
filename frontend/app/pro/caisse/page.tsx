import type { Metadata } from 'next';
import Link from 'next/link';
import { getCashDay, getPendingReservations } from '@/lib/api-pro';
import { ApiError } from '@/lib/api';
import { PlanLocked } from '../plan-locked';
import { fr } from '@/lib/i18n/fr';
import {
  addDays,
  formatLongDate,
  formatPrice,
  todayLocalDate,
} from '@/lib/format';
import { requireSessionToken } from '@/lib/session';
import { cashReservationAction, deleteCashMovementAction } from '../actions';
import { CashForm } from './cash-form';

export const metadata: Metadata = { title: fr.pro.cash.title };

type PageProps = { searchParams: Promise<{ date?: string }> };

export default async function CashPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const params = await searchParams;

  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '')
    ? (params.date as string)
    : todayLocalDate();

  let journal;
  let pending;
  try {
    [journal, pending] = await Promise.all([
      getCashDay(token, day),
      getPendingReservations(token, day),
    ]);
  } catch (error) {
    // Module hors offre : on présente ce qu'il apporte plutôt qu'une erreur.
    if (error instanceof ApiError && error.status === 403) {
      return <PlanLocked module="cash" />;
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold capitalize">
          {formatLongDate(day)}
        </h1>
        {day !== todayLocalDate() && (
          <Link
            href="/pro/caisse"
            className="shrink-0 text-sm text-accent underline underline-offset-4"
          >
            {fr.pro.cash.today}
          </Link>
        )}
      </div>
      <p className="mb-5 text-sm text-muted">{fr.pro.cash.help}</p>

      <div className="mb-6 flex gap-2">
        <Link
          href={`/pro/caisse?date=${addDays(day, -1)}`}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium"
        >
          ← {fr.pro.cash.previousDay}
        </Link>
        <Link
          href={`/pro/caisse?date=${addDays(day, 1)}`}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium"
        >
          {fr.pro.cash.nextDay} →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Total label={fr.pro.cash.sales} value={journal.salesCents} />
        <Total label={fr.pro.cash.expenses} value={journal.expensesCents} />
        <Total
          label={fr.pro.cash.balance}
          value={journal.balanceCents}
          highlight
        />
      </div>

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-lg font-semibold">{fr.pro.cash.pending}</h2>
          <p className="mb-3 text-sm text-muted">{fr.pro.cash.pendingHelp}</p>

          <ul className="space-y-2">
            {pending.map((reservation) => (
              <li
                key={reservation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft p-4"
              >
                <div>
                  <p className="font-medium">
                    {reservation.localTime} · {reservation.clientFirstName}
                  </p>
                  <p className="text-sm text-muted">
                    {reservation.label}
                    {reservation.employeeName &&
                      ` · ${reservation.employeeName}`}
                  </p>
                </div>

                <form action={cashReservationAction} className="shrink-0">
                  <input
                    type="hidden"
                    name="reservationId"
                    value={reservation.id}
                  />
                  <input
                    type="hidden"
                    name="amountCents"
                    value={reservation.amountCents}
                  />
                  <input
                    type="hidden"
                    name="label"
                    value={`${reservation.label} — ${reservation.clientFirstName}`}
                  />
                  <input
                    type="hidden"
                    name="employeeId"
                    value={reservation.employeeId ?? ''}
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                  >
                    {fr.pro.cash.cash} {formatPrice(reservation.amountCents)}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {journal.items.length === 0 ? (
        <p className="mb-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.cash.empty}
        </p>
      ) : (
        <ul className="mb-2 space-y-2">
          {journal.items.map((movement) => (
            <li
              key={movement.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium">{movement.label}</p>
                <p className="text-sm text-muted">
                  {movement.localTime}
                  {movement.employeeName && ` · ${movement.employeeName}`}
                  {movement.type === 'SALE' &&
                    ` · ${fr.pro.cash[`method${movement.method}`]}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`font-semibold ${
                    movement.type === 'SALE' ? 'text-accent' : 'text-danger'
                  }`}
                >
                  {movement.type === 'SALE' ? '+' : '−'}
                  {formatPrice(movement.amountCents)}
                </span>

                <form action={deleteCashMovementAction}>
                  <input type="hidden" name="id" value={movement.id} />
                  <button
                    type="submit"
                    aria-label={fr.pro.cash.remove}
                    className="h-10 rounded-xl border border-border px-3 text-sm text-muted"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-6 text-sm text-muted">{fr.pro.cash.removeHelp}</p>

      <div className="space-y-4">
        <CashForm type="SALE" />
        <CashForm type="EXPENSE" />
      </div>
    </main>
  );
}

function Total({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 font-semibold ${
          // Un solde négatif est une information, pas une anomalie : on
          // l'affiche franchement plutôt que de le masquer.
          highlight && value < 0 ? 'text-danger' : ''
        }`}
      >
        {formatPrice(value)}
      </p>
    </div>
  );
}
