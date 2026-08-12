"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { ArrowLeftIcon, CheckIcon, CloseIcon, WhatsAppIcon } from "@/components/icons";
import {
  ApiError,
  api,
  type AvailabilityDay,
  type Reservation,
  type Salon,
  type Weekday,
} from "@/lib/api";
import {
  algiersDateTimeToUtcIso,
  formatDayHeading,
  formatDuration,
  formatPrice,
  isValidAlgerianPhone,
  todayAlgiersDateString,
} from "@/lib/format";

type Step = "closed" | "select" | "slots" | "confirm" | "success";

const STEP_LABELS: Record<Exclude<Step, "closed">, string> = {
  select: "Étape 1/3 · Prestations",
  slots: "Étape 2/3 · Créneau",
  confirm: "Étape 3/3 · Confirmation",
  success: "C'est confirmé",
};

const DOW_TO_WEEKDAY: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function weekdayOf(dateStr: string): Weekday {
  const date = new Date(`${dateStr}T12:00:00+01:00`);
  return DOW_TO_WEEKDAY[date.getUTCDay()];
}

/** Génère toutes les cases de 30 min entre `open` et `close` (bornes "HH:mm"). */
function generateDaySlots(open: string, close: string): string[] {
  const [openHour, openMinute] = open.split(":").map(Number);
  const [closeHour, closeMinute] = close.split(":").map(Number);
  const startMinutes = openHour * 60 + openMinute;
  const endMinutes = closeHour * 60 + closeMinute;
  const slots: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return slots;
}

interface AvailabilityState {
  loading: boolean;
  error: string | null;
  days: AvailabilityDay[];
}

export function BookingWizard({ salon }: { salon: Salon }) {
  const [step, setStep] = useState<Step>("closed");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<AvailabilityState>({
    loading: false,
    error: null,
    days: [],
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<Reservation | null>(null);

  const todayStr = useMemo(() => todayAlgiersDateString(), []);

  const selectedPrestations = useMemo(
    () => salon.prestations.filter((p) => selectedIds.has(p.id)),
    [salon.prestations, selectedIds],
  );
  const totalPriceCents = selectedPrestations.reduce(
    (sum, p) => sum + p.priceCents,
    0,
  );
  const totalDurationMinutes = selectedPrestations.reduce(
    (sum, p) => sum + p.durationMinutes,
    0,
  );

  // Lock background scroll while the overlay is open.
  useEffect(() => {
    if (step === "closed") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [step]);

  /**
   * Charge les disponibilités pour la sélection courante de prestations.
   * Appelée explicitement (au clic "Continuer", ou après un conflit 409)
   * plutôt que depuis un effect, pour rester synchronisée avec l'action
   * utilisateur qui la déclenche.
   */
  async function loadAvailability(ids: string[]) {
    setAvailability({ loading: true, error: null, days: [] });
    try {
      const days = await api.getAvailability(salon.slug, ids, 7);
      setAvailability({ loading: false, error: null, days });
      const firstWithSlots = days.find((d) => d.slots.length > 0);
      setSelectedDate((firstWithSlots ?? days[0])?.date ?? null);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Impossible de charger les disponibilités. Réessaie.";
      setAvailability({ loading: false, error: message, days: [] });
    }
  }

  function goToSlots() {
    setStep("slots");
    void loadAvailability(Array.from(selectedIds));
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openWizard() {
    setStep("select");
  }

  function resetAndClose() {
    setStep("closed");
    setSelectedIds(new Set());
    setAvailability({ loading: false, error: null, days: [] });
    setSelectedDate(null);
    setChosenTime(null);
    setConflictMessage(null);
    setFirstName("");
    setPhoneDigits("");
    setSubmitError(null);
    setResult(null);
  }

  function handleBack() {
    if (step === "slots") setStep("select");
    else if (step === "confirm") setStep("slots");
  }

  function selectSlot(date: string, time: string) {
    setConflictMessage(null);
    setSelectedDate(date);
    setChosenTime(time);
    setStep("confirm");
  }

  async function handleSubmit() {
    if (!selectedDate || !chosenTime) return;

    const trimmedName = firstName.trim();
    if (trimmedName.length < 2) {
      setSubmitError("Merci d'indiquer ton prénom (au moins 2 lettres).");
      return;
    }
    const phone = `+213${phoneDigits}`;
    if (!isValidAlgerianPhone(phone)) {
      setSubmitError(
        "Numéro invalide. Format attendu : +213 suivi de 9 chiffres (5, 6 ou 7 pour commencer).",
      );
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const startsAt = algiersDateTimeToUtcIso(selectedDate, chosenTime);
      const reservation = await api.createReservation(salon.slug, {
        prestationIds: Array.from(selectedIds),
        startsAt,
        clientFirstName: trimmedName,
        clientPhone: phone,
      });
      setResult(reservation);
      setStep("success");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflictMessage(
          error.message ||
            "Ce créneau vient d'être pris, choisis-en un autre.",
        );
        setChosenTime(null);
        setStep("slots");
        void loadAvailability(Array.from(selectedIds));
      } else if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Une erreur est survenue. Réessaie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const cheapestPrice = salon.prestations.reduce(
    (min, p) => (p.priceCents < min ? p.priceCents : min),
    salon.prestations[0]?.priceCents ?? 0,
  );

  return (
    <>
      {/* Barre de déclenchement, toujours visible sous la fiche salon */}
      {step === "closed" && salon.prestations.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-navy/10 bg-beige/95 px-5 py-4 backdrop-blur">
          <Button onClick={openWizard}>
            Réserver — à partir de {formatPrice(cheapestPrice)}
          </Button>
        </div>
      )}

      {step !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Réservation"
          className="fixed inset-0 z-50 flex flex-col bg-beige"
        >
          <header className="flex items-center gap-2 border-b border-navy/10 bg-beige/95 px-3 py-3 backdrop-blur">
            {(step === "slots" || step === "confirm") && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Retour"
                className="rounded-full p-2 text-navy hover:bg-navy/5"
              >
                <ArrowLeftIcon />
              </button>
            )}
            <div className="flex-1 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sand">
                {STEP_LABELS[step]}
              </p>
              <p className="truncate text-sm font-semibold text-navy">
                {salon.name}
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Fermer"
              className="rounded-full p-2 text-navy hover:bg-navy/5"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {step === "select" && (
              <div className="space-y-3">
                <p className="text-sm text-navy/60">
                  Sélectionne une ou plusieurs prestations.
                </p>
                {salon.prestations.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={checked}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        checked
                          ? "border-sand bg-sand/10"
                          : "border-navy/10 bg-white"
                      }`}
                    >
                      <span>
                        <span className="block font-medium text-navy">
                          {p.name}
                        </span>
                        <span className="block text-xs text-navy/50">
                          {formatDuration(p.durationMinutes)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-navy">
                          {formatPrice(p.priceCents)}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            checked
                              ? "border-sand bg-sand text-navy"
                              : "border-navy/20"
                          }`}
                        >
                          {checked && <CheckIcon className="h-3 w-3" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === "slots" && (
              <div className="space-y-4">
                {conflictMessage && (
                  <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                    {conflictMessage}
                  </div>
                )}

                {availability.loading && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-14 shrink-0" />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <Skeleton key={i} className="h-11" />
                      ))}
                    </div>
                  </div>
                )}

                {availability.error && (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-danger">{availability.error}</p>
                    <Button
                      variant="ghost"
                      onClick={() => setStep("select")}
                    >
                      Revenir aux prestations
                    </Button>
                  </div>
                )}

                {!availability.loading &&
                  !availability.error &&
                  availability.days.length > 0 && (
                    <>
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {availability.days.map((day) => {
                          const active = day.date === selectedDate;
                          const hasSlots = day.slots.length > 0;
                          return (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => setSelectedDate(day.date)}
                              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap ${
                                active
                                  ? "bg-navy text-beige"
                                  : hasSlots
                                    ? "bg-white text-navy ring-1 ring-navy/10"
                                    : "bg-navy/5 text-navy/40"
                              }`}
                            >
                              {formatDayHeading(day.date, todayStr)}
                            </button>
                          );
                        })}
                      </div>

                      <SlotGrid
                        salon={salon}
                        selectedDate={selectedDate}
                        availability={availability.days}
                        onSelectSlot={selectSlot}
                      />
                    </>
                  )}
              </div>
            )}

            {step === "confirm" && selectedDate && chosenTime && (
              <div className="space-y-5">
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sand">
                    Récap
                  </p>
                  <p className="mt-1 font-semibold text-navy">{salon.name}</p>
                  <ul className="mt-2 space-y-1 text-sm text-navy/70">
                    {selectedPrestations.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{p.name}</span>
                        <span>{formatPrice(p.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-navy/10 pt-3 text-sm">
                    <p className="font-medium text-navy">
                      {formatDayHeading(selectedDate, todayStr)} à {chosenTime}
                    </p>
                    <p className="text-navy/60">
                      {formatDuration(totalDurationMinutes)} ·{" "}
                      {formatPrice(totalPriceCents)}
                    </p>
                  </div>
                </Card>

                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-navy"
                  >
                    Ton prénom
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex : Yasmine"
                    className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-navy"
                  >
                    Ton numéro de téléphone
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-3 focus-within:border-sand">
                    <span className="text-navy/50">+213</span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={9}
                      value={phoneDigits}
                      onChange={(e) =>
                        setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 9))
                      }
                      placeholder="5XXXXXXXX"
                      className="w-full flex-1 bg-transparent text-base text-navy outline-none"
                    />
                  </div>
                  <p className="mt-1 text-xs text-navy/40">
                    Format : +213XXXXXXXXX
                  </p>
                </div>

                {submitError && (
                  <p className="text-sm text-danger">{submitError}</p>
                )}
              </div>
            )}

            {step === "success" && result && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckIcon className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-navy">
                    C&apos;est confirmé !
                  </h2>
                  <p className="mt-1 text-navy/70">
                    Ton rendez-vous chez {salon.name} est réservé.
                  </p>
                </div>

                <Card className="space-y-1 text-left text-sm text-navy/70">
                  <p className="font-semibold text-navy">
                    {formatDayHeading(
                      result.startsAt.slice(0, 10),
                      todayStr,
                    )}{" "}
                    — {chosenTime}
                  </p>
                  {result.prestations.map((p) => (
                    <p key={p.prestationId} className="flex justify-between">
                      <span>{p.name}</span>
                      <span>{formatPrice(p.priceCents)}</span>
                    </p>
                  ))}
                  <p className="border-t border-navy/10 pt-2 font-medium text-navy">
                    Total : {formatPrice(result.totalPriceCents)}
                  </p>
                </Card>

                <a
                  href={result.whatsappConfirmationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("secondary")}
                >
                  <WhatsAppIcon />
                  Envoie-toi la confirmation sur WhatsApp
                </a>
                <p className="text-xs text-navy/50">
                  Ce message n&apos;est pas envoyé automatiquement : appuie sur
                  le bouton pour te l&apos;envoyer toi-même, ça prend deux
                  secondes.
                </p>

                <p className="text-sm text-navy/70">
                  Tu pourras annuler à tout moment depuis cette page :{" "}
                  <Link
                    href={`/annulation/${result.cancellationToken}`}
                    className="font-medium text-navy underline"
                  >
                    /annulation/{result.cancellationToken.slice(0, 8)}…
                  </Link>
                </p>

                <Button variant="ghost" onClick={resetAndClose}>
                  Retour à la fiche du salon
                </Button>
              </div>
            )}
          </div>

          {step === "select" && (
            <footer className="border-t border-navy/10 bg-beige/95 px-5 py-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-sm text-navy/70">
                <span>{selectedIds.size} prestation(s)</span>
                <span>
                  {formatDuration(totalDurationMinutes)} ·{" "}
                  {formatPrice(totalPriceCents)}
                </span>
              </div>
              <Button disabled={selectedIds.size === 0} onClick={goToSlots}>
                Continuer
              </Button>
            </footer>
          )}

          {step === "confirm" && (
            <footer className="border-t border-navy/10 bg-beige/95 px-5 py-4 backdrop-blur">
              <Button onClick={handleSubmit} loading={submitting}>
                Confirmer
              </Button>
            </footer>
          )}
        </div>
      )}
    </>
  );
}

function SlotGrid({
  salon,
  selectedDate,
  availability,
  onSelectSlot,
}: {
  salon: Salon;
  selectedDate: string | null;
  availability: AvailabilityDay[];
  onSelectSlot: (date: string, time: string) => void;
}) {
  if (!selectedDate) return null;

  const day = availability.find((d) => d.date === selectedDate);
  if (!day) return null;

  const weekday = weekdayOf(selectedDate);
  const hours = salon.openingHours[weekday];

  if (!hours) {
    return (
      <p className="rounded-xl bg-navy/5 px-4 py-6 text-center text-sm text-navy/50">
        Fermé ce jour-là. Choisis un autre jour.
      </p>
    );
  }

  const allSlots = generateDaySlots(hours.open, hours.close);
  const freeSet = new Set(day.slots);

  if (allSlots.length === 0) {
    return (
      <p className="rounded-xl bg-navy/5 px-4 py-6 text-center text-sm text-navy/50">
        Aucun créneau ce jour-là.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {allSlots.map((time) => {
        const isFree = freeSet.has(time);
        return (
          <button
            key={time}
            type="button"
            disabled={!isFree}
            onClick={() => onSelectSlot(selectedDate, time)}
            className={
              isFree
                ? "rounded-xl border border-navy/15 bg-white py-2.5 text-sm font-medium text-navy hover:border-sand hover:bg-sand/10"
                : "slot-unavailable rounded-xl border border-navy/5 bg-navy/5 py-2.5 text-sm font-medium text-navy/40"
            }
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}
