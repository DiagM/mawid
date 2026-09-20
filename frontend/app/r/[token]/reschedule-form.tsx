'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  getRescheduleOptions,
  rescheduleReservationByToken,
  type Availability,
  type ReservationView,
} from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, todayLocalDate, addDays } from '@/lib/format';

/**
 * Déplacement d'un rendez-vous par la cliente.
 *
 * Les créneaux viennent d'une route dédiée qui exclut ce rendez-vous des
 * intervalles occupés : sans cela il se bloquerait lui-même, et le décaler
 * d'un quart d'heure serait refusé.
 *
 * Le rendez-vous est **mis à jour**, jamais annulé puis recréé : le lien de
 * gestion déjà reçu sur WhatsApp reste valable, et le créneau d'origine
 * n'est libéré qu'une fois le nouveau obtenu — annuler d'abord exposerait à
 * tout perdre si le créneau visé partait entre-temps.
 */
export function RescheduleForm({
  token,
  onDone,
  onCancel,
}: {
  token: string;
  onDone: (reservation: ReservationView) => void;
  onCancel: () => void;
}) {
  const today = todayLocalDate();
  const [date, setDate] = useState(today);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Résultat du chargement, TOUJOURS étiqueté du jour demandé.
   *
   * Un simple `loading` mis à `true` au début de l'effet violerait la règle
   * `react-hooks/set-state-in-effect` : React interdit un `setState`
   * synchrone dans un effet. En étiquetant le résultat, l'état de chargement
   * se déduit — et une réponse tardive pour un autre jour ne peut plus
   * écraser l'affichage courant.
   */
  const [result, setResult] = useState<{
    date: string;
    availability: Availability | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let abandoned = false;

    getRescheduleOptions(token, date)
      .then((availability) => {
        if (!abandoned) {
          setResult({ date, availability, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!abandoned) {
          setResult({
            date,
            availability: null,
            error:
              err instanceof ApiError && err.status !== 0
                ? err.message
                : fr.common.networkError,
          });
        }
      });

    return () => {
      abandoned = true;
    };
  }, [token, date]);

  const loading = result === null || result.date !== date;
  const availability = loading ? null : result.availability;
  const error = failure ?? (loading ? null : result.error);

  async function choose(startsAt: string) {
    setPending(true);
    setFailure(null);

    try {
      onDone(await rescheduleReservationByToken(token, startsAt));
    } catch (err) {
      setFailure(
        err instanceof ApiError && err.isSlotConflict
          ? fr.manage.rescheduleTaken
          : err instanceof ApiError && err.status !== 0
            ? err.message
            : fr.common.networkError,
      );

      // Le créneau vient de partir : on recharge pour ne pas laisser un
      // bouton qui échouera à nouveau.
      const refreshed = await getRescheduleOptions(token, date).catch(
        () => null,
      );
      setResult({ date, availability: refreshed, error: null });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">{fr.manage.rescheduleTitle}</h2>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.manage.rescheduleDay}
        </span>
        <input
          type="date"
          value={date}
          min={today}
          // L'horizon de réservation est de 14 jours, aujourd'hui compris.
          max={addDays(today, 13)}
          onChange={(event) => setDate(event.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <p className="mt-2 text-sm capitalize text-muted">
        {formatLongDate(date)}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted">{fr.common.loading}</p>
        ) : !availability || availability.slots.length === 0 ? (
          <p className="text-sm text-muted">{fr.manage.rescheduleNoSlot}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {availability.slots.map((slot) => (
              <li key={slot.startsAt}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void choose(slot.startsAt)}
                  className="h-11 rounded-xl border border-border px-4 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {slot.localTime}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-4 text-sm text-muted underline underline-offset-4"
      >
        {fr.manage.rescheduleKeep}
      </button>
    </section>
  );
}
