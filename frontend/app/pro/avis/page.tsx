import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getReviewRequests } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { RatingBadge, Stars } from '@/components/stars';
import { formatLongDate } from '@/lib/format';

export const metadata: Metadata = { title: fr.pro.reviews.title };

interface ManagerReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isPublished: boolean;
  clientFirstName: string;
  visitedAt: string;
  employeeName: string | null;
}

interface ManagerReviews {
  average: number | null;
  count: number;
  items: ManagerReview[];
}

/**
 * Avis reçus.
 *
 * Page volontairement en lecture seule : aucun bouton pour masquer ou
 * supprimer. Un salon capable de cacher ses mauvaises notes rendrait tout le
 * système d'avis sans valeur — et c'est précisément cette impossibilité qui
 * donne du poids aux bonnes notes.
 */
export default async function ManagerReviewsPage() {
  const token = await requireSessionToken();
  const [reviews, requests] = await Promise.all([
    apiFetch<ManagerReviews>('/reviews/me', { token }),
    getReviewRequests(token),
  ]);

  const pending = requests.items.filter(
    (item) => item.reviewRequestedAt === null,
  ).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{fr.pro.reviews.title}</h1>
        <RatingBadge average={reviews.average} count={reviews.count} />
      </div>
      <p className="mb-6 text-sm text-muted">{fr.pro.reviews.help}</p>

      {/* C'est ici qu'un gerant se demande pourquoi il a si peu d'avis :
          autant lui mettre la reponse sous les yeux. */}
      {pending > 0 && (
        <Link
          href="/pro/avis/demander"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft p-4"
        >
          <span className="text-sm font-medium text-accent">
            {fr.pro.reviewRequests.banner.replace('{count}', String(pending))}
          </span>
          <span className="text-sm font-semibold text-accent underline underline-offset-4">
            {fr.pro.reviewRequests.bannerAction}
          </span>
        </Link>
      )}

      {reviews.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">{fr.pro.reviews.empty}</p>
          <p className="mt-1 text-sm text-muted">{fr.pro.reviews.emptyHelp}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reviews.items.map((review) => (
            <li
              key={review.id}
              className={`rounded-xl border border-border bg-surface p-4 ${
                review.isPublished ? '' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{review.clientFirstName}</span>
                <Stars rating={review.rating} size="sm" />
              </div>

              <p className="mt-0.5 text-sm text-muted">
                {fr.pro.reviews.visitedOn}{' '}
                <span className="capitalize">
                  {formatLongDate(review.visitedAt.slice(0, 10))}
                </span>
                {review.employeeName && ` · ${review.employeeName}`}
              </p>

              {review.comment && (
                <p className="mt-2 leading-relaxed">{review.comment}</p>
              )}

              {!review.isPublished && (
                <p className="mt-2 text-sm text-danger">
                  {fr.pro.reviews.hidden}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
