import type { Metadata } from 'next';
import { getBlockedSlots } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, todayLocalDate } from '@/lib/format';
import { requireSessionToken } from '@/lib/session';
import { deleteBlockedSlotAction } from '../actions';
import { BlockedForm } from './blocked-form';

export const metadata: Metadata = { title: fr.pro.blocked.title };

export default async function BlockedSlotsPage() {
  const token = await requireSessionToken();
  const today = todayLocalDate();
  const slots = await getBlockedSlots(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.blocked.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.pro.blocked.help}</p>

      {slots.length === 0 ? (
        <p className="mb-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.blocked.empty}
        </p>
      ) : (
        <ul className="mb-6 space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium capitalize">
                  {formatLongDate(slot.localDate)}
                </p>
                <p className="text-sm text-muted">
                  {slot.localStartTime} – {slot.localEndTime}
                  {slot.reason && ` · ${slot.reason}`}
                </p>
              </div>

              <form action={deleteBlockedSlotAction}>
                <input type="hidden" name="id" value={slot.id} />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-xl border border-danger px-4 text-sm font-medium text-danger"
                >
                  {fr.pro.blocked.remove}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <BlockedForm today={today} />
    </main>
  );
}
