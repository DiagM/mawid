import type { Metadata } from 'next';
import { getMyPrestations } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatDuration, formatPrice } from '@/lib/format';
import { requireSessionToken } from '@/lib/session';
import {
  archivePrestationAction,
  restorePrestationAction,
} from '../actions';
import { PrestationForm } from './prestation-form';

export const metadata: Metadata = { title: fr.pro.prestations.title };

export default async function PrestationsPage() {
  const token = await requireSessionToken();
  const prestations = await getMyPrestations(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">{fr.pro.prestations.title}</h1>

      {prestations.length === 0 ? (
        <p className="mb-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.prestations.empty}
        </p>
      ) : (
        <ul className="mb-6 space-y-2">
          {prestations.map((prestation) => (
            <li
              key={prestation.id}
              className={`rounded-xl border border-border bg-surface p-4 ${
                prestation.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-medium">{prestation.name}</h2>
                <span className="shrink-0 font-semibold text-accent">
                  {formatPrice(prestation.priceCents)}
                </span>
              </div>

              {prestation.description && (
                <p className="mt-1 text-sm text-muted">
                  {prestation.description}
                </p>
              )}

              <p className="mt-1 text-sm text-muted">
                {formatDuration(prestation.durationMinutes)}
                {!prestation.isActive && ` · ${fr.pro.prestations.archived}`}
              </p>

              <form
                action={
                  prestation.isActive
                    ? archivePrestationAction
                    : restorePrestationAction
                }
                className="mt-3"
              >
                <input type="hidden" name="id" value={prestation.id} />
                <button
                  type="submit"
                  className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
                >
                  {prestation.isActive
                    ? fr.pro.prestations.archive
                    : fr.pro.prestations.restore}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-6 text-sm text-muted">
        {fr.pro.prestations.archiveHelp}
      </p>

      <PrestationForm />
    </main>
  );
}
