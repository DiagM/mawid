import type { Metadata } from 'next';
import Link from 'next/link';
import { getMySalon, getReminders } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, formatPhone, todayLocalDate, addDays } from '@/lib/format';
import { manageUrl } from '@/lib/booking-share';
import { getRequestOrigin } from '@/lib/request-origin';
import { requireSessionToken } from '@/lib/session';
import { setRemindedAction } from '../actions';

export const metadata: Metadata = { title: fr.pro.reminders.title };

type PageProps = { searchParams: Promise<{ date?: string }> };

/**
 * Liste du soir : les rendez-vous de demain, prêts à rappeler.
 *
 * Le no-show est le problème numéro un des rendez-vous en beauté, et les
 * statistiques du salon le mesurent déjà sans qu'aucun outil ne le combatte.
 *
 * Mawid n'envoie rien — un message automatique se facturerait à l'unité. Le
 * lien `wa.me` est préparé, le gérant écrit depuis son propre numéro, ce qui
 * donne au message une chance d'être lu.
 */
export default async function RemindersPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const params = await searchParams;

  const [reminders, salon, origin] = await Promise.all([
    getReminders(token, params.date),
    getMySalon(token),
    getRequestOrigin(),
  ]);

  const done = reminders.items.filter(
    (item) => item.remindedAt !== null,
  ).length;

  const today = todayLocalDate();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.reminders.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.pro.reminders.help}</p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.reminders.day}
          </span>
          <input
            type="date"
            name="date"
            defaultValue={reminders.date}
            min={today}
            max={addDays(today, 13)}
            className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="h-12 rounded-xl border border-border px-4 text-sm font-medium"
        >
          {fr.common.retry}
        </button>
      </form>

      <p className="mb-1 font-medium capitalize">
        {formatLongDate(reminders.date)}
      </p>

      {reminders.items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.reminders.empty}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {fr.pro.reminders.progress
              .replace('{done}', String(done))
              .replace('{total}', String(reminders.items.length))}
          </p>

          <ul className="space-y-2">
            {reminders.items.map((item) => {
              const isDone = item.remindedAt !== null;
              const message = fr.pro.reminders.message
                .replace('{firstName}', item.clientFirstName)
                .replace('{time}', item.localTime)
                .replace('{salon}', salon.name)
                .replace('{link}', manageUrl(item.cancellationToken, origin));

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border border-border bg-surface p-4 ${
                    isDone ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.localTime} · {item.clientFirstName}
                      </p>
                      <p className="text-sm text-muted">
                        {formatPhone(item.clientPhone)}
                      </p>
                      <p className="text-sm text-muted">
                        {item.prestations}
                        {item.employeeName && ` · ${item.employeeName}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {isDone ? (
                        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                          {fr.pro.reminders.sent}
                        </span>
                      ) : (
                        <a
                          href={`https://wa.me/${item.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                        >
                          {fr.pro.reminders.send}
                        </a>
                      )}

                      <form action={setRemindedAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="reminded"
                          value={String(!isDone)}
                        />
                        <button
                          type="submit"
                          className="text-sm text-muted underline underline-offset-4"
                        >
                          {isDone
                            ? fr.pro.reminders.markPending
                            : fr.pro.reminders.markSent}
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-xs text-muted">
            {fr.pro.reminders.linkHelp}
          </p>
        </>
      )}

      <Link
        href="/pro"
        className="mt-6 inline-block text-sm text-muted underline underline-offset-4"
      >
        {fr.common.back}
      </Link>
    </main>
  );
}
