import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api';
import {
  getAgenda,
  getMe,
  getMySalon,
  getWaitlist,
  type AgendaReservation,
  type WaitlistEntry,
} from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import {
  addDays,
  formatLongDate,
  formatPhone,
  formatPrice,
  todayLocalDate,
} from '@/lib/format';
import { requireSessionToken } from '@/lib/session';
import { setReservationStatusAction } from './actions';
import { WaitlistPanel } from './waitlist-panel';

type PageProps = { searchParams: Promise<{ date?: string }> };

/** Statuts affichés par une pastille de couleur, du plus neutre au plus fort. */
const STATUS_STYLES: Record<AgendaReservation['status'], string> = {
  CONFIRMED: 'bg-accent-soft text-accent',
  HONORED: 'bg-accent text-white',
  NO_SHOW: 'bg-danger-soft text-danger',
  CANCELED: 'bg-border text-muted',
};

export default async function AgendaPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const { date } = await searchParams;

  const me = await getMe(token);
  // Tant que le mot de passe généré n'est pas remplacé, aucun autre écran
  // n'est accessible : un secret connu de deux personnes ne doit pas durer.
  if (me.mustChangePassword) {
    redirect('/pro/mot-de-passe');
  }

  const day = date ?? todayLocalDate();

  // Un compte peut n'avoir aucun salon : c'est le cas du fondateur, dont le
  // rôle est d'administrer la plateforme et non de tenir un agenda. Laisser
  // remonter le 404 afficherait un écran d'erreur serveur pour une situation
  // parfaitement normale.
  let reservations: AgendaReservation[];
  try {
    reservations = await getAgenda(token, day, day);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      if (me.role === 'ADMIN') {
        redirect('/admin');
      }
      return <NoSalon />;
    }
    throw error;
  }

  // Liste d'attente du jour affiché. Un échec ne doit pas emporter l'agenda,
  // qui est l'écran de travail : on dégrade en n'affichant rien.
  let waiting: WaitlistEntry[] = [];
  let salonName = '';
  try {
    const [entries, salon] = await Promise.all([
      getWaitlist(token, day, day),
      getMySalon(token),
    ]);
    waiting = entries;
    salonName = salon.name;
  } catch {
    waiting = [];
  }

  const honoredRevenue = reservations
    .filter((reservation) => reservation.status === 'HONORED')
    .reduce((total, reservation) => total + reservation.totalPriceCents, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <WaitlistPanel entries={waiting} salonName={salonName} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold capitalize">
          {formatLongDate(day)}
        </h1>
        {day !== todayLocalDate() && (
          <Link
            href="/pro"
            className="shrink-0 text-sm text-accent underline underline-offset-4"
          >
            {fr.pro.agenda.today}
          </Link>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        <Link
          href={`/pro?date=${addDays(day, -1)}`}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium"
        >
          ← {fr.pro.agenda.previousDay}
        </Link>
        <Link
          href={`/pro?date=${addDays(day, 1)}`}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium"
        >
          {fr.pro.agenda.nextDay} →
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.agenda.empty}
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {reservations.map((reservation) => (
              <li
                key={reservation.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {reservation.localTime}
                    </p>
                    <p className="font-medium">
                      {reservation.clientFirstName}
                    </p>
                    <a
                      href={`tel:${reservation.clientPhone}`}
                      className="text-sm text-accent underline underline-offset-4"
                    >
                      {formatPhone(reservation.clientPhone)}
                    </a>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[reservation.status]}`}
                  >
                    {fr.manage.status[reservation.status]}
                  </span>
                </div>

                <ul className="mt-3 border-t border-border pt-3 text-sm">
                  {reservation.prestations.map((line) => (
                    <li
                      key={line.name}
                      className="flex justify-between gap-4 text-muted"
                    >
                      <span>{line.name}</span>
                      <span>{formatPrice(line.priceCents)}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 flex justify-between font-semibold">
                  <span>{fr.booking.total}</span>
                  <span>{formatPrice(reservation.totalPriceCents)}</span>
                </p>

                {reservation.status === 'CONFIRMED' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusButton
                      id={reservation.id}
                      status="HONORED"
                      label={fr.pro.agenda.markHonored}
                      className="border-accent text-accent"
                    />
                    <StatusButton
                      id={reservation.id}
                      status="NO_SHOW"
                      label={fr.pro.agenda.markNoShow}
                      className="border-border text-muted"
                    />
                    <StatusButton
                      id={reservation.id}
                      status="CANCELED"
                      label={fr.pro.agenda.markCanceled}
                      className="border-danger text-danger"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {honoredRevenue > 0 && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-4">
              <p className="flex justify-between font-semibold">
                <span>{fr.pro.agenda.revenue}</span>
                <span>{formatPrice(honoredRevenue)}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {fr.pro.agenda.revenueHelp}
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function StatusButton({
  id,
  status,
  label,
  className,
}: {
  id: string;
  status: 'HONORED' | 'NO_SHOW' | 'CANCELED';
  label: string;
  className: string;
}) {
  return (
    <form action={setReservationStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`h-10 rounded-xl border px-4 text-sm font-medium ${className}`}
      >
        {label}
      </button>
    </form>
  );
}

/**
 * Écran d'un compte sans salon.
 *
 * Ne devrait pas arriver à un gérant — son salon est créé avec son compte —
 * mais un état impossible affiché clairement vaut mieux qu'une page blanche
 * avec une trace de pile.
 */
function NoSalon() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="font-medium">{fr.pro.noSalon}</p>
        <p className="mt-1 text-sm text-muted">{fr.pro.noSalonHelp}</p>
      </div>
    </main>
  );
}
