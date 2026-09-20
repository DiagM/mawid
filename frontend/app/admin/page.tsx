import type { Metadata } from 'next';
import Link from 'next/link';
import { getOverview, getSalons } from '@/lib/api-admin';
import { fr } from '@/lib/i18n/fr';
import { formatInstantDate } from '@/lib/format';
import { requireAdminToken } from '@/lib/session';
import { setSalonActiveAction } from './actions';
import { SalonCommercialForm } from './salon-commercial-form';

export const metadata: Metadata = { title: fr.admin.overview.title };

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const FILTERS = [
  { value: 'all', label: fr.admin.salons.filterAll },
  { value: 'pending', label: fr.admin.salons.filterPending },
  { value: 'active', label: fr.admin.salons.filterActive },
];

export default async function AdminHomePage({ searchParams }: PageProps) {
  const token = await requireAdminToken();
  const params = await searchParams;

  const status = FILTERS.some((filter) => filter.value === params.status)
    ? params.status!
    : 'all';
  const q = params.q?.trim() ?? '';

  const [overview, salons] = await Promise.all([
    getOverview(token),
    getSalons(token, { status, q }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold">{fr.admin.overview.title}</h1>

      {/* Les salons en attente passent en premier : c'est la seule donnée de
          cet écran qui appelle une action immédiate. */}
      {overview.salons.pending > 0 && (
        <div className="mb-6 rounded-xl border border-accent bg-surface p-4">
          <p className="font-medium">
            {overview.salons.pending} {fr.admin.overview.salonsPending}
          </p>
          <p className="mt-1 text-sm text-muted">
            {fr.admin.overview.pendingHelp}
          </p>
          <Link
            href="/admin?status=pending"
            className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {fr.admin.salons.filterPending}
          </Link>
        </div>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={fr.admin.overview.salonsActive} value={overview.salons.active} />
        <Stat label={fr.admin.overview.managers} value={overview.managers} />
        <Stat
          label={fr.admin.overview.reservations}
          value={overview.reservationsThisMonth}
        />
        <Stat label={fr.admin.overview.clients} value={overview.clients} />
        <Stat
          label={fr.admin.overview.reviewsPublished}
          value={overview.reviews.published}
        />
        <Stat
          label={fr.admin.overview.reviewsHidden}
          value={overview.reviews.hidden}
        />
      </dl>

      <h2 className="mb-3 text-lg font-semibold">{fr.admin.salons.title}</h2>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={fr.admin.salons.search}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          {fr.admin.salons.search}
        </button>
      </form>

      <nav className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin?status=${filter.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            aria-current={filter.value === status ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter.value === status
                ? 'bg-accent text-white'
                : 'border border-border text-muted'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {salons.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.admin.salons.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {salons.map((salon) => (
            <li
              key={salon.id}
              className={`rounded-xl border bg-surface p-4 ${
                salon.isActive ? 'border-border' : 'border-accent'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">
                    {salon.name}{' '}
                    <span className="text-sm font-normal text-muted">
                      /{salon.slug}
                    </span>
                  </h3>
                  <p className="text-sm text-muted">
                    {salon.district}, {salon.city}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {fr.admin.salons.owner} : {salon.owner.fullName ?? '—'} ·{' '}
                    {salon.owner.phone}
                  </p>
                  <p className="text-sm text-muted">
                    {salon.owner.lastLogin
                      ? fr.admin.salons.lastLogin.replace(
                          '{date}',
                          formatInstantDate(salon.owner.lastLogin),
                        )
                      : fr.admin.salons.neverConnected}
                  </p>
                  <p className="text-sm text-muted">
                    {fr.admin.salons.counts
                      .replace('{prestations}', String(salon.prestations))
                      .replace('{employees}', String(salon.employees))}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
                  {!salon.isActive && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                      {fr.admin.salons.pending}
                    </span>
                  )}
                  {salon.isFeatured && salon.featuredUntil && (
                    <span className="text-xs text-muted">
                      ⭐ {fr.admin.salons.featured}{' '}
                      {fr.admin.salons.featuredUntil.replace(
                        '{date}',
                        formatInstantDate(salon.featuredUntil),
                      )}
                    </span>
                  )}
                  <span className="text-muted">
                    {salon.quota.limit === null
                      ? fr.admin.salons.quotaUnlimited
                      : fr.admin.salons.quotaUsed
                          .replace('{used}', String(salon.quota.used))
                          .replace('{limit}', String(salon.quota.limit))}
                  </span>

                  <form action={setSalonActiveAction}>
                    <input type="hidden" name="salonId" value={salon.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={String(!salon.isActive)}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-3 py-1.5"
                    >
                      {salon.isActive
                        ? fr.admin.salons.deactivate
                        : fr.admin.salons.activate}
                    </button>
                  </form>

                  {salon.isActive && (
                    <Link
                      href={`/${salon.slug}`}
                      className="text-accent underline"
                    >
                      {fr.admin.salons.view}
                    </Link>
                  )}
                </div>
              </div>

              <SalonCommercialForm
                salonId={salon.id}
                userId={salon.owner.id}
                plan={salon.quota.plan}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
