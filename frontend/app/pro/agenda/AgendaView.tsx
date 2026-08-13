"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  WhatsAppIcon,
} from "@/components/icons";
import {
  ApiError,
  api,
  type AgendaReservation,
  type BlockedSlot,
  type DayAgenda,
  type ManualReservationStatus,
  type ReservationStatus,
} from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import {
  addCalendarDays,
  algiersDateTimeToUtcIso,
  formatAlgiersTime,
  formatDayHeading,
  formatDuration,
  formatPrice,
  nowAlgiersTimeString,
  todayAlgiersDateString,
} from "@/lib/format";

interface AgendaState {
  loading: boolean;
  error: string | null;
  data: DayAgenda | null;
}

type TimelineItem =
  | { kind: "reservation"; startsAt: string; reservation: AgendaReservation }
  | { kind: "blocked"; startsAt: string; blockedSlot: BlockedSlot };

export function AgendaView() {
  const router = useRouter();
  const todayStr = useMemo(() => todayAlgiersDateString(), []);
  const [date, setDate] = useState(todayStr);
  const [retryTick, setRetryTick] = useState(0);
  const [agenda, setAgenda] = useState<AgendaState>({
    loading: true,
    error: null,
    data: null,
  });
  const [statusAction, setStatusAction] = useState<{
    id: string;
    error: string | null;
  } | null>(null);
  const [expandedBlockedId, setExpandedBlockedId] = useState<string | null>(
    null,
  );
  const [deletingBlockedId, setDeletingBlockedId] = useState<string | null>(
    null,
  );
  const [blockFormOpen, setBlockFormOpen] = useState(false);

  useEffect(() => {
    async function loadDay() {
      setAgenda({ loading: true, error: null, data: null });
      const token = getToken();
      if (!token) return;
      try {
        const data = await api.getMyDayAgenda(token, date);
        setAgenda({ loading: false, error: null, data });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.replace("/pro/connexion");
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Impossible de charger l'agenda. Réessaie.";
        setAgenda({ loading: false, error: message, data: null });
      }
    }
    void loadDay();
  }, [date, retryTick, router]);

  async function handleMarkStatus(
    id: string,
    status: ManualReservationStatus,
  ) {
    setStatusAction({ id, error: null });
    const token = getToken();
    if (!token) return;
    try {
      const updated = await api.updateReservationStatus(token, id, status);
      setAgenda((prev) =>
        prev.data
          ? {
              ...prev,
              data: {
                ...prev.data,
                reservations: prev.data.reservations.map((r) =>
                  r.id === id ? updated : r,
                ),
              },
            }
          : prev,
      );
      setStatusAction(null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Action impossible. Réessaie.";
      setStatusAction({ id, error: message });
    }
  }

  async function handleDeleteBlockedSlot(id: string) {
    setDeletingBlockedId(id);
    const token = getToken();
    if (!token) return;
    try {
      await api.deleteBlockedSlot(token, id);
      setAgenda((prev) =>
        prev.data
          ? {
              ...prev,
              data: {
                ...prev.data,
                blockedSlots: prev.data.blockedSlots.filter(
                  (b) => b.id !== id,
                ),
              },
            }
          : prev,
      );
      setExpandedBlockedId(null);
    } catch {
      // Best-effort : si la suppression échoue, le blocage reste affiché
      // (le gérant peut réessayer en rouvrant la ligne).
    } finally {
      setDeletingBlockedId(null);
    }
  }

  function handleBlockedCreated(slot: BlockedSlot) {
    setAgenda((prev) =>
      prev.data
        ? {
            ...prev,
            data: {
              ...prev.data,
              blockedSlots: [...prev.data.blockedSlots, slot],
            },
          }
        : prev,
    );
    setBlockFormOpen(false);
  }

  const timeline: TimelineItem[] = useMemo(() => {
    if (!agenda.data) return [];
    const items: TimelineItem[] = [
      ...agenda.data.reservations.map((r) => ({
        kind: "reservation" as const,
        startsAt: r.startsAt,
        reservation: r,
      })),
      ...agenda.data.blockedSlots.map((b) => ({
        kind: "blocked" as const,
        startsAt: b.startsAt,
        blockedSlot: b,
      })),
    ];
    return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [agenda.data]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDate((d) => addCalendarDays(d, -1))}
          aria-label="Jour précédent"
          className="rounded-full p-2 text-navy hover:bg-navy/5"
        >
          <ChevronLeftIcon />
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold tracking-wide text-sand uppercase">
            Agenda
          </p>
          <p className="text-lg font-bold text-navy">
            {formatDayHeading(date, todayStr)}
          </p>
          {date !== todayStr && (
            <button
              type="button"
              onClick={() => setDate(todayStr)}
              className="text-xs font-medium text-navy underline underline-offset-4"
            >
              Revenir à aujourd&apos;hui
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDate((d) => addCalendarDays(d, 1))}
          aria-label="Jour suivant"
          className="rounded-full p-2 text-navy hover:bg-navy/5"
        >
          <ChevronRightIcon />
        </button>
      </header>

      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => setBlockFormOpen((v) => !v)}
        >
          <PlusIcon className="h-4 w-4" />
          Bloquer un créneau
        </Button>
        {blockFormOpen && (
          <BlockSlotForm
            date={date}
            isToday={date === todayStr}
            onCreated={handleBlockedCreated}
            onCancel={() => setBlockFormOpen(false)}
          />
        )}
      </div>

      <div className="mt-5 flex-1 space-y-3 pb-6">
        {agenda.loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!agenda.loading && agenda.error && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-danger">{agenda.error}</p>
            <Button
              variant="ghost"
              onClick={() => setRetryTick((c) => c + 1)}
            >
              Réessayer
            </Button>
          </div>
        )}

        {!agenda.loading && !agenda.error && timeline.length === 0 && (
          <p className="rounded-xl bg-navy/5 px-4 py-10 text-center text-sm text-navy/50">
            Aucun rendez-vous ce jour-là.
          </p>
        )}

        {!agenda.loading &&
          !agenda.error &&
          timeline.map((item) =>
            item.kind === "reservation" ? (
              <ReservationCard
                key={item.reservation.id}
                reservation={item.reservation}
                busyId={statusAction?.id ?? null}
                errorForId={
                  statusAction && statusAction.id === item.reservation.id
                    ? statusAction.error
                    : null
                }
                onMarkStatus={handleMarkStatus}
              />
            ) : (
              <BlockedSlotRow
                key={item.blockedSlot.id}
                slot={item.blockedSlot}
                expanded={expandedBlockedId === item.blockedSlot.id}
                deleting={deletingBlockedId === item.blockedSlot.id}
                onToggle={() =>
                  setExpandedBlockedId((id) =>
                    id === item.blockedSlot.id ? null : item.blockedSlot.id,
                  )
                }
                onDelete={() => handleDeleteBlockedSlot(item.blockedSlot.id)}
              />
            ),
          )}
      </div>
    </main>
  );
}

const STATUS_BADGES: Partial<
  Record<ReservationStatus, { label: string; className: string }>
> = {
  HONORED: { label: "Honoré", className: "bg-success/10 text-success" },
  NO_SHOW: { label: "No-show", className: "bg-danger/10 text-danger" },
  CANCELED: { label: "Annulé", className: "bg-navy/10 text-navy/50" },
};

function ReservationCard({
  reservation,
  busyId,
  errorForId,
  onMarkStatus,
}: {
  reservation: AgendaReservation;
  busyId: string | null;
  errorForId: string | null;
  onMarkStatus: (id: string, status: ManualReservationStatus) => void;
}) {
  const isBusy = busyId === reservation.id;
  const isCanceled = reservation.status === "CANCELED";
  const prestationNames = reservation.prestations.map((p) => p.name).join(", ");
  const digitsOnly = reservation.clientPhone.replace(/\D/g, "");
  const badge = STATUS_BADGES[reservation.status];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-semibold text-navy ${isCanceled ? "line-through opacity-60" : ""}`}
          >
            {formatAlgiersTime(reservation.startsAt)} –{" "}
            {formatAlgiersTime(reservation.endsAt)}
          </p>
          <p
            className={`truncate text-sm text-navy/70 ${isCanceled ? "line-through opacity-60" : ""}`}
          >
            {reservation.clientFirstName} · {prestationNames}
          </p>
          <p className="text-xs text-navy/50">
            {formatDuration(reservation.totalDurationMinutes)} ·{" "}
            {formatPrice(reservation.totalPriceCents)}
          </p>
        </div>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <a
          href={`tel:${reservation.clientPhone}`}
          aria-label={`Appeler ${reservation.clientFirstName}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-navy/5 text-navy"
        >
          <PhoneIcon className="h-4 w-4" />
        </a>
        <a
          href={`https://wa.me/${digitsOnly}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${reservation.clientFirstName}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success"
        >
          <WhatsAppIcon className="h-4 w-4" />
        </a>

        {reservation.status === "CONFIRMED" && (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onMarkStatus(reservation.id, "HONORED")}
              className="rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success disabled:opacity-50"
            >
              Honoré
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onMarkStatus(reservation.id, "NO_SHOW")}
              className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
            >
              No-show
            </button>
          </div>
        )}
      </div>

      {errorForId && <p className="mt-2 text-xs text-danger">{errorForId}</p>}
    </Card>
  );
}

function BlockedSlotRow({
  slot,
  expanded,
  deleting,
  onToggle,
  onDelete,
}: {
  slot: BlockedSlot;
  expanded: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-navy/5 ring-1 ring-navy/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-navy/70">
            {formatAlgiersTime(slot.startsAt)} – {formatAlgiersTime(slot.endsAt)}{" "}
            · Bloqué
          </p>
          {slot.reason && (
            <p className="text-xs text-navy/50">{slot.reason}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-navy/40">
          {expanded ? "Fermer" : "Gérer"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-navy/10 px-4 py-3">
          <Button variant="danger" loading={deleting} onClick={onDelete}>
            <TrashIcon className="h-4 w-4" />
            Supprimer ce blocage
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockSlotForm({
  date,
  isToday,
  onCreated,
  onCancel,
}: {
  date: string;
  isToday: boolean;
  onCreated: (slot: BlockedSlot) => void;
  onCancel: () => void;
}) {
  const defaultStart = useMemo(
    () => (isToday ? nowAlgiersTimeString() : "09:00"),
    [isToday],
  );
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState("23:59");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fillFullDay() {
    setStartTime("00:00");
    setEndTime("23:59");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (startTime >= endTime) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const slot = await api.createBlockedSlot(token, {
        startsAt: algiersDateTimeToUtcIso(date, startTime),
        endsAt: algiersDateTimeToUtcIso(date, endTime),
        reason: reason.trim() || undefined,
      });
      onCreated(slot);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de créer le blocage. Réessaie.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-2xl border border-navy/10 bg-white p-4"
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="block-start"
            className="block text-xs font-medium text-navy/60"
          >
            Début
          </label>
          <input
            id="block-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="block-end"
            className="block text-xs font-medium text-navy/60"
          >
            Fin
          </label>
          <input
            id="block-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={fillFullDay}
        className="text-xs font-medium text-navy underline underline-offset-4"
      >
        Toute la journée
      </button>

      <div>
        <label
          htmlFor="block-reason"
          className="block text-xs font-medium text-navy/60"
        >
          Motif (optionnel)
        </label>
        <input
          id="block-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex : pause déjeuner"
          maxLength={200}
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-sand"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={submitting}>
          Bloquer ce créneau
        </Button>
      </div>
    </form>
  );
}
