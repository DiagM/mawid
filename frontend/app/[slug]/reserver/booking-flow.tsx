'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ApiError,
  createReservation,
  getAvailability,
  type AvailableSlot,
  type PublicSalon,
  type ReservationView,
} from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { WaitlistForm } from './waitlist-form';
import {
  addDays,
  daysBetween,
  formatDuration,
  formatPrice,
  formatShortDate,
  todayLocalDate,
  toE164,
} from '@/lib/format';
import { Confirmation } from './confirmation';

/** Doit rester aligné avec `BOOKING_HORIZON_DAYS` côté backend. */
const HORIZON_DAYS = 14;
const MAX_PRESTATIONS = 3;

type Step = 'services' | 'slot' | 'details';

export function BookingFlow({
  salon,
  origin,
}: {
  salon: PublicSalon;
  /** Origine publique, calculée côté serveur (voir lib/request-origin.ts). */
  origin: string;
}) {
  const [step, setStep] = useState<Step>('services');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState<string>(todayLocalDate());
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  /**
   * Membre souhaité. `null` = « peu importe », le serveur choisit alors la
   * première ressource libre. C'est le cas par défaut et le plus courant :
   * la plupart des clients n'ont pas de préférence.
   */
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const hasTeam = salon.employees.length > 0;

  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  // Piège à robots : un humain ne voit jamais ce champ (docs/SECURITY.md §1.1).
  const [website, setWebsite] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reservation, setReservation] = useState<ReservationView | null>(null);

  const selected = useMemo(
    () => salon.prestations.filter((p) => selectedIds.includes(p.id)),
    [salon.prestations, selectedIds],
  );

  const totalPrice = selected.reduce((sum, p) => sum + p.priceCents, 0);
  const totalDuration = selected.reduce((sum, p) => sum + p.durationMinutes, 0);

  const days = useMemo(() => {
    const today = todayLocalDate();
    return Array.from({ length: HORIZON_DAYS }, (_, index) =>
      addDays(today, index),
    );
  }, []);

  /**
   * Chargement des creneaux.
   *
   * Appele depuis les gestionnaires d'evenements (passage a l'etape, choix
   * d'un jour, conflit 409) et non depuis un `useEffect` : c'est une reaction
   * a une action utilisateur, pas une synchronisation avec un systeme externe.
   * Un effet ici declencherait en plus des `setState` en cascade, que React
   * signale desormais comme une erreur (`react-hooks/set-state-in-effect`).
   *
   * La date est passee en parametre pour ne pas dependre d'un etat qui n'est
   * pas encore applique au moment de l'appel.
   */
  const loadSlots = useCallback(
    async (targetDate: string, ids: string[], withEmployee?: string | null) => {
      if (ids.length === 0) {
        return;
      }

      setSlots(null);
      setSlotsError(null);
      setSelectedSlot(null);

      try {
        const availability = await getAvailability(
          salon.slug,
          targetDate,
          ids,
          withEmployee ?? undefined,
        );
        setSlots(availability.slots);
      } catch (error) {
        setSlots([]);
        setSlotsError(
          error instanceof ApiError && error.status === 0
            ? fr.common.networkError
            : fr.booking.noSlots,
        );
      }
    },
    [salon.slug],
  );

  function goToSlots() {
    setStep('slot');
    void loadSlots(date, selectedIds, employeeId);
  }

  function selectDate(day: string) {
    setDate(day);
    void loadSlots(day, selectedIds, employeeId);
  }

  /** Changer de membre recalcule immédiatement les créneaux affichés. */
  function selectEmployee(id: string | null) {
    setEmployeeId(id);
    void loadSlots(date, selectedIds, id);
  }

  function toggleService(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= MAX_PRESTATIONS) {
        return current;
      }
      return [...current, id];
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (firstName.trim().length < 2) {
      setFormError(fr.booking.firstNameInvalid);
      return;
    }

    const e164 = toE164(phone);
    if (!e164) {
      setFormError(fr.booking.phoneInvalid);
      return;
    }

    if (!selectedSlot) {
      setFormError(fr.booking.noSlots);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createReservation(salon.slug, {
        startsAt: selectedSlot,
        prestationIds: selectedIds,
        ...(employeeId && { employeeId }),
        clientFirstName: firstName.trim(),
        clientPhone: e164,
        website,
      });
      setReservation(created);
    } catch (error) {
      if (error instanceof ApiError && error.isSlotConflict) {
        // Quelqu'un a pris le créneau entre l'affichage et la validation :
        // on renvoie au choix du créneau avec une liste rafraîchie.
        setFormError(fr.booking.slotTaken);
        setStep('slot');
        void loadSlots(date, selectedIds, employeeId);
      } else if (error instanceof ApiError && error.status === 0) {
        setFormError(fr.common.networkError);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : fr.common.error,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (reservation) {
    return (
      <Confirmation reservation={reservation} salon={salon} origin={origin} />
    );
  }

  return (
    <div className="pb-32">
      <Steps current={step} />

      {step === 'services' && (
        <section aria-labelledby="etape-prestations">
          <h2 id="etape-prestations" className="mb-1 text-lg font-semibold">
            {fr.booking.stepServices}
          </h2>
          <p className="mb-4 text-sm text-muted">{fr.booking.selectServices}</p>

          <ul className="space-y-2">
            {salon.prestations.map((prestation) => {
              const isSelected = selectedIds.includes(prestation.id);
              const isDisabled =
                !isSelected && selectedIds.length >= MAX_PRESTATIONS;

              return (
                <li key={prestation.id}>
                  <button
                    type="button"
                    onClick={() => toggleService(prestation.id)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface'
                    } ${isDisabled ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-medium">{prestation.name}</span>
                      <span className="shrink-0 font-semibold text-accent">
                        {formatPrice(prestation.priceCents)}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm text-muted">
                      {formatDuration(prestation.durationMinutes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedIds.length >= MAX_PRESTATIONS && (
            <p className="mt-3 text-sm text-muted">{fr.booking.maxServices}</p>
          )}
        </section>
      )}

      {step === 'slot' && (
        <section aria-labelledby="etape-creneau">
          <h2 id="etape-creneau" className="mb-1 text-lg font-semibold">
            {fr.booking.stepSlot}
          </h2>
          {hasTeam && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium">
                {fr.booking.stepEmployee}
              </p>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectEmployee(null)}
                    aria-pressed={employeeId === null}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors ${
                      employeeId === null
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {fr.booking.anyEmployee}
                  </button>

                  {salon.employees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => selectEmployee(employee.id)}
                      aria-pressed={employeeId === employee.id}
                      className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors ${
                        employeeId === employee.id
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-surface'
                      }`}
                    >
                      {employee.fullName}
                    </button>
                  ))}
                </div>
              </div>
              {employeeId === null && (
                <p className="mt-2 text-sm text-muted">
                  {fr.booking.anyEmployeeHelp}
                </p>
              )}
            </div>
          )}

          <p className="mb-4 text-sm text-muted">{fr.booking.chooseDay}</p>

          <div className="-mx-4 mb-5 overflow-x-auto px-4">
            <div className="flex gap-2">
              {days.map((day) => {
                const offset = daysBetween(todayLocalDate(), day);
                const label =
                  offset === 0
                    ? fr.booking.today
                    : offset === 1
                      ? fr.booking.tomorrow
                      : formatShortDate(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDate(day)}
                    aria-pressed={day === date}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-sm capitalize transition-colors ${
                      day === date
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {slots === null ? (
            <p className="text-muted">{fr.booking.loadingSlots}</p>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p>{slotsError ?? fr.booking.noSlots}</p>
              <p className="mt-1 text-sm text-muted">
                {fr.booking.tryAnotherDay}
              </p>

              {/* Proposé uniquement en cas d'échec du chargement : sinon on
                  inviterait à s'inscrire sur une liste d'attente alors que
                  la journée n'est peut-être pas complète. */}
              {!slotsError && (
                <WaitlistForm
                  slug={salon.slug}
                  date={date}
                  prestationIds={selectedIds}
                />
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <li key={slot.startsAt}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    aria-pressed={slot.startsAt === selectedSlot}
                    className={`h-11 w-full rounded-xl border text-sm font-medium transition-colors ${
                      slot.startsAt === selectedSlot
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {slot.localTime}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {formError && (
            <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
              {formError}
            </p>
          )}
        </section>
      )}

      {step === 'details' && (
        <form onSubmit={submit} aria-labelledby="etape-coordonnees">
          <h2 id="etape-coordonnees" className="mb-1 text-lg font-semibold">
            {fr.booking.stepDetails}
          </h2>
          <p className="mb-4 text-sm text-muted">
            {fr.booking.noAccountNeeded}
          </p>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium">
              {fr.booking.firstName}
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder={fr.booking.firstNamePlaceholder}
              autoComplete="given-name"
              required
              maxLength={50}
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
            />
          </label>

          <label className="mb-2 block">
            <span className="mb-1 block text-sm font-medium">
              {fr.booking.phone}
            </span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={fr.booking.phonePlaceholder}
              autoComplete="tel"
              required
              className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
            />
          </label>
          <p className="mb-4 text-sm text-muted">{fr.booking.phoneHelp}</p>

          {/*
            Honeypot. `aria-hidden` + `tabIndex={-1}` le rendent invisible aux
            lecteurs d'écran et à la navigation clavier : seul un robot qui
            remplit aveuglément le DOM le renseigne.
          */}
          <div aria-hidden="true" className="absolute left-[-9999px]">
            <label>
              Site web
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          {formError && (
            <p className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? fr.booking.submitting : fr.booking.submit}
          </button>
        </form>
      )}

      {/* Récapitulatif + action principale, toujours sous le pouce. */}
      {step !== 'details' && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            {selected.length > 0 && (
              <div className="mb-3 flex justify-between text-sm">
                <span className="text-muted">
                  {selected.length} · {formatDuration(totalDuration)}
                </span>
                <span className="font-semibold">
                  {fr.booking.total} {formatPrice(totalPrice)}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              {step === 'slot' && (
                <button
                  type="button"
                  onClick={() => setStep('services')}
                  className="h-12 shrink-0 rounded-xl border border-border px-5 font-medium"
                >
                  {fr.common.back}
                </button>
              )}
              <button
                type="button"
                disabled={
                  step === 'services'
                    ? selectedIds.length === 0
                    : selectedSlot === null
                }
                onClick={() =>
                  step === 'services' ? goToSlots() : setStep('details')
                }
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                {fr.booking.continue}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'details' && (
        <button
          type="button"
          onClick={() => setStep('slot')}
          className="mt-4 text-sm text-muted underline underline-offset-4"
        >
          {fr.common.back}
        </button>
      )}

      <p className="mt-8 text-center text-sm">
        <Link
          href={`/${salon.slug}`}
          className="text-muted underline underline-offset-4"
        >
          {salon.name}
        </Link>
      </p>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ['services', 'slot', 'details'];
  const index = order.indexOf(current);

  return (
    <ol className="mb-6 flex gap-1.5" aria-label={fr.booking.title}>
      {order.map((step, position) => (
        <li
          key={step}
          aria-current={step === current ? 'step' : undefined}
          className={`h-1.5 flex-1 rounded-full ${
            position <= index ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </ol>
  );
}
