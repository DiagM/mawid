"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CheckIcon } from "@/components/icons";
import { ApiError, api, type ReservationStatus, type ReservationWithSalon } from "@/lib/api";
import {
  formatAlgiersDateLong,
  formatAlgiersTime,
  formatDuration,
  formatPrice,
} from "@/lib/format";

const READ_ONLY_MESSAGES: Partial<Record<ReservationStatus, string>> = {
  HONORED: "Ce rendez-vous a déjà eu lieu.",
  NO_SHOW: "Ce rendez-vous a été marqué comme non honoré.",
};

export function CancellationView({
  token,
  initialReservation,
  initialIsPast,
}: {
  token: string;
  initialReservation: ReservationWithSalon;
  initialIsPast: boolean;
}) {
  const [reservation, setReservation] = useState(initialReservation);
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPast = reservation.status === "CONFIRMED" && initialIsPast;

  async function handleCancel() {
    setCanceling(true);
    setError(null);
    try {
      const updated = await api.cancelReservation(token);
      setReservation(updated);
      setConfirming(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'annuler ce rendez-vous pour le moment. Réessaie.",
      );
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-2 text-left">
        <p className="text-xs font-semibold tracking-wide text-sand uppercase">
          {reservation.salonName}
        </p>
        <p className="font-semibold text-navy">
          {formatAlgiersDateLong(reservation.startsAt)} à{" "}
          {formatAlgiersTime(reservation.startsAt)}
        </p>
        <ul className="space-y-1 text-sm text-navy/70">
          {reservation.prestations.map((p) => (
            <li key={p.prestationId} className="flex justify-between">
              <span>{p.name}</span>
              <span>{formatPrice(p.priceCents)}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-navy/10 pt-2 text-sm font-medium text-navy">
          {formatDuration(reservation.totalDurationMinutes)} ·{" "}
          {formatPrice(reservation.totalPriceCents)}
        </p>
        <p className="text-xs text-navy/50">
          Réservé au nom de {reservation.clientFirstName}
        </p>
      </Card>

      {reservation.status === "CONFIRMED" && !isPast && (
        <div className="space-y-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          {!confirming ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Annuler mon rendez-vous
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm font-medium text-navy">
                Es-tu sûr de vouloir annuler ce rendez-vous ? Cette action est
                définitive.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                  disabled={canceling}
                >
                  Non, garder
                </Button>
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  loading={canceling}
                >
                  Oui, annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {reservation.status === "CONFIRMED" && isPast && (
        <p className="rounded-xl bg-navy/5 px-4 py-4 text-center text-sm text-navy/60">
          Ce rendez-vous est déjà passé, il ne peut plus être annulé en ligne.
        </p>
      )}

      {reservation.status === "CANCELED" && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-4 text-sm font-medium text-success">
          <CheckIcon className="h-4 w-4" />
          Ce rendez-vous est annulé.
        </div>
      )}

      {(reservation.status === "HONORED" || reservation.status === "NO_SHOW") && (
        <p className="rounded-xl bg-navy/5 px-4 py-4 text-center text-sm text-navy/60">
          {READ_ONLY_MESSAGES[reservation.status]}
        </p>
      )}
    </div>
  );
}
