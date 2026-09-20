import type { Metadata } from 'next';
import Link from 'next/link';
import { getReviews } from '@/lib/api-admin';
import { fr } from '@/lib/i18n/fr';
import { formatInstantDate } from '@/lib/format';
import { Stars } from '@/components/stars';
import { requireAdminToken } from '@/lib/session';
import { moderateReviewAction } from '../actions';

export const metadata: Metadata = { title: fr.admin.reviews.title };

type PageProps = {
  searchParams: Promise<{ visibility?: string; maxRating?: string }>;
};

const FILTERS = [
  { value: 'all', label: fr.admin.reviews.filterAll },
  { value: 'published', label: fr.admin.reviews.filterPublished },
  { value: 'hidden', label: fr.admin.reviews.filterHidden },
];

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const token = await requireAdminToken();
  const params = await searchParams;

  const visibility = FILTERS.some((filter) => filter.value === params.visibility)
    ? params.visibility!
    : 'all';

  // Le cas réel de la modération : un gérant signale un avis à une étoile.
  const lowOnly = params.maxRating === '2';

  const reviews = await getReviews(token, {
    visibility,
    ...(lowOnly && { maxRating: 2 }),
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.admin.reviews.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.admin.reviews.help}</p>

      <nav className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/avis?visibility=${filter.value}${lowOnly ? '&maxRating=2' : ''}`}
            aria-current={filter.value === visibility ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter.value === visibility
                ? 'bg-accent text-white'
                : 'border border-border text-muted'
            }`}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href={`/admin/avis?visibility=${visibility}${lowOnly ? '' : '&maxRating=2'}`}
          aria-current={lowOnly ? 'page' : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            lowOnly ? 'bg-accent text-white' : 'border border-border text-muted'
          }`}
        >
          {fr.admin.reviews.lowRatings}
        </Link>
      </nav>

      {reviews.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.admin.reviews.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className={`rounded-xl border border-border bg-surface p-4 ${
                review.isPublished ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars rating={review.rating} />
                    {!review.isPublished && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                        {fr.admin.reviews.hidden}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm">
                    <Link
                      href={`/${review.salonSlug}`}
                      className="text-accent underline"
                    >
                      {review.salonName}
                    </Link>{' '}
                    · {review.clientFirstName}
                  </p>

                  {review.comment && (
                    <p className="mt-2 text-sm">{review.comment}</p>
                  )}

                  <p className="mt-1 text-xs text-muted">
                    {fr.admin.reviews.visitedOn.replace(
                      '{date}',
                      formatInstantDate(review.visitedAt),
                    )}
                  </p>
                </div>

                <form action={moderateReviewAction} className="shrink-0">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input
                    type="hidden"
                    name="isPublished"
                    value={String(!review.isPublished)}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm"
                  >
                    {review.isPublished
                      ? fr.admin.reviews.hide
                      : fr.admin.reviews.publish}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
