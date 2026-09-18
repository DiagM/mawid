'use client';

import { useState } from 'react';
import {
  ApiError,
  cancelReservationByToken,
  type ReservationView,
} from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, formatPrice } from '@/lib/format';
import { salonPhoneLink } from '@/lib/booking-share';

export function ManageReservation({
  reservation: initial,
  token,
  isUpcoming,
}: {
  reservation: ReservationView;
  token: string;
  /**
   * Calculé côté serveur : comparer à `Date.now()` pendant le rendu est une
   * fonction impure, que React interdit (règle `react-hooks/purity`) car le
   * résultat changerait à chaque re-rendu.
   */
  isUpcoming: boolean;
}) {
  const [reservation, setReservation] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isCanceled = reservation.status === 'CANCELED';

  async function cancel() {
    setPending(true);
    setError(null);

    try {
      await cancelReservationByToken(token);
      setReservation({ ...reservation, status: 'CANCELED' });
      setConfirming(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : fr.common.networkError,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{fr.manage.title}</h1>

      <section
        className={`mb-6 rounded-xl border p-4 ${
          isCanceled
            ? 'border-border bg-surface opacity-70'
            : 'border-border bg-surface'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              isCanceled
                ? 'bg-danger-soft text-danger'
                : 'bg-accent-soft text-accent'
            }`}
          >
            {fr.manage.status[reservation.status]}
          </span>
        </div>

        <p className="font-medium capitalize">
          {formatLongDate(reservation.localDate)} · {reservation.localTime}
        </p>
        {reservation.salon && (
          <p className="mt-1 text-muted">
            {fr.confirmation.at} {reservation.salon.name}
          </p>
        )}

        <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          {reservation.prestations.map((line) => (
            <li key={line.name} className="flex justify-between gap-4">
              <span>{line.name}</span>
              <span className="text-muted">{formatPrice(line.priceCents)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
          <span>{fr.booking.total}</span>
          <span>{formatPrice(reservation.totalPriceCents)}</span>
        </p>
      </section>

      {isCanceled ? (
        <div className="rounded-xl bg-danger-soft p-4">
          <p className="font-medium text-danger">{fr.manage.canceled}</p>
          <p className="mt-1 text-sm">{fr.manage.canceledHelp}</p>
        </div>
      ) : (
        isUpcoming && (
          <div>
            {confirming ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="mb-4 font-medium">{fr.manage.cancelTitle}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="h-12 flex-1 rounded-xl border border-border font-medium"
                  >
                    {fr.manage.cancelKeep}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={pending}
                    className="h-12 flex-1 rounded-xl bg-danger font-semibold text-white disabled:opacity-60"
                  >
                    {fr.manage.cancelConfirm}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="h-12 w-full rounded-xl border border-danger font-medium text-danger"
              >
                {fr.manage.cancelAction}
              </button>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )
      )}

      {reservation.salon && (
        <a
          href={salonPhoneLink(reservation.salon.contactPhone)}
          className="mt-6 block text-center text-sm text-muted underline underline-offset-4"
        >
          {fr.manage.callSalon}
        </a>
      )}
    </div>
  );
}
