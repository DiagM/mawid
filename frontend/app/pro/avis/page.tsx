import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
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
  const reviews = await apiFetch<ManagerReviews>('/reviews/me', { token });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{fr.pro.reviews.title}</h1>
        <RatingBadge average={reviews.average} count={reviews.count} />
      </div>
      <p className="mb-6 text-sm text-muted">{fr.pro.reviews.help}</p>

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
