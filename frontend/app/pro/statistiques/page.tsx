import type { Metadata } from 'next';
import Link from 'next/link';
import { getStats } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPrice, todayLocalDate, addDays } from '@/lib/format';
import { requireSessionToken } from '@/lib/session';

export const metadata: Metadata = { title: fr.pro.stats.title };

type PageProps = { searchParams: Promise<{ days?: string }> };

const RANGES = [
  { days: 7, label: fr.pro.stats.last7 },
  { days: 30, label: fr.pro.stats.last30 },
  { days: 90, label: fr.pro.stats.last90 },
];

export default async function StatsPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const params = await searchParams;

  const days = RANGES.some((range) => String(range.days) === params.days)
    ? Number(params.days)
    : 30;

  const to = todayLocalDate();
  const from = addDays(to, -(days - 1));
  const stats = await getStats(token, from, to);

  const hasData = stats.current.counts.total > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{fr.pro.stats.title}</h1>

      <nav aria-label={fr.pro.stats.period} className="mb-6 flex gap-2">
        {RANGES.map((range) => (
          <Link
            key={range.days}
            href={`/pro/statistiques?days=${range.days}`}
            aria-current={range.days === days ? 'page' : undefined}
            className={`flex h-10 flex-1 items-center justify-center rounded-xl border text-sm font-medium transition-colors ${
              range.days === days
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface'
            }`}
          >
            {range.label}
          </Link>
        ))}
      </nav>

      {!hasData ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">{fr.pro.stats.empty}</p>
          <p className="mt-1 text-sm text-muted">{fr.pro.stats.emptyHelp}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Metric
              label={fr.pro.stats.revenue}
              value={formatPrice(stats.current.revenueCents)}
              delta={percentDelta(
                stats.current.revenueCents,
                stats.previous.revenueCents,
              )}
              help={fr.pro.stats.revenueHelp}
            />
            <Metric
              label={fr.pro.stats.honored}
              value={String(stats.current.counts.honored)}
              delta={percentDelta(
                stats.current.counts.honored,
                stats.previous.counts.honored,
              )}
            />
            <Metric
              label={fr.pro.stats.averageBasket}
              value={
                stats.current.averageBasketCents === null
                  ? fr.pro.stats.noData
                  : formatPrice(stats.current.averageBasketCents)
              }
              delta={percentDelta(
                stats.current.averageBasketCents,
                stats.previous.averageBasketCents,
              )}
            />
            <Metric
              label={fr.pro.stats.noShowRate}
              value={
                stats.current.noShowRate === null
                  ? fr.pro.stats.noData
                  : `${stats.current.noShowRate.toLocaleString('fr-FR')} %`
              }
              // Un taux d'absence qui monte est une mauvaise nouvelle :
              // l'indicateur est inversé pour que le vert reste positif.
              delta={percentDelta(
                stats.current.noShowRate,
                stats.previous.noShowRate,
              )}
              lowerIsBetter
              help={fr.pro.stats.noShowHelp}
            />
          </div>

          <p className="mb-6 text-center text-sm text-muted">
            {fr.pro.stats.vsPrevious}
          </p>

          {stats.clients.total > 0 && (
            <section className="mb-6 rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 font-semibold">{fr.pro.stats.clients}</h2>
              <p>
                <span className="text-2xl font-semibold">
                  {stats.clients.total}
                </span>{' '}
                <span className="text-muted">
                  — {stats.clients.new} {fr.pro.stats.newClients},{' '}
                  {stats.clients.returning} {fr.pro.stats.returningClients}
                </span>
              </p>
            </section>
          )}

          {stats.topPrestations.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">
                {fr.pro.stats.topPrestations}
              </h2>
              <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                {stats.topPrestations.map((prestation) => (
                  <li
                    key={prestation.name}
                    className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <span>
                      {prestation.name}{' '}
                      <span className="text-muted">× {prestation.count}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent">
                      {formatPrice(prestation.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stats.byEmployee.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">
                {fr.pro.stats.byEmployee}
              </h2>
              <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                {stats.byEmployee.map((employee) => (
                  <li
                    key={employee.id}
                    className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <span>
                      {employee.fullName}{' '}
                      <span className="text-muted">× {employee.count}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent">
                      {formatPrice(employee.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

/**
 * Écart en pourcentage entre deux périodes.
 *
 * `null` quand la comparaison n'a pas de sens : pas de valeur précédente
 * (tout écart serait « +∞ ») ou pas de valeur actuelle. Mieux vaut ne rien
 * afficher qu'un « +100 % » trompeur sur un premier mois d'activité.
 */
function percentDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function Metric({
  label,
  value,
  delta,
  help,
  lowerIsBetter = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  help?: string;
  lowerIsBetter?: boolean;
}) {
  const isGood = delta === null ? null : lowerIsBetter ? delta < 0 : delta > 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>

      {delta !== null && delta !== 0 && (
        <p
          className={`mt-1 text-sm font-medium ${
            isGood ? 'text-accent' : 'text-danger'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta.toLocaleString('fr-FR')} %
        </p>
      )}

      {help && <p className="mt-2 text-xs text-muted">{help}</p>}
    </div>
  );
}
