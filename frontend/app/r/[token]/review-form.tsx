'use client';

import { useState } from 'react';
import { ApiError, createReview } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';

/**
 * Dépôt d'un avis depuis la page de gestion du rendez-vous.
 *
 * Le formulaire n'est rendu que pour un rendez-vous honoré et pas encore noté
 * — c'est la page serveur qui en décide. Le serveur revérifie de toute façon
 * ces deux conditions : un POST direct ne contourne rien.
 */
export function ReviewForm({ token }: { token: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  // Piège à robots (docs/SECURITY.md §1.1).
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (rating === null) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      await createReview(token, {
        rating,
        comment: comment.trim() || undefined,
        website,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : fr.common.networkError,
      );
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-accent-soft p-4 text-center">
        <p className="font-medium text-accent">{fr.review.thanks}</p>
        <p className="mt-1 text-sm">{fr.review.thanksHelp}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 font-semibold">{fr.review.title}</h2>
      <p className="mb-4 text-sm text-muted">{fr.review.prompt}</p>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-medium">
          {fr.review.ratingLabel}
        </legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} ${value > 1 ? fr.review.stars : fr.review.star}`}
              className={`h-12 flex-1 rounded-xl border text-lg transition-colors ${
                rating !== null && value <= rating
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-background text-border'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.review.commentLabel}
        </span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder={fr.review.commentPlaceholder}
          className="w-full rounded-xl border border-border bg-background p-4 outline-none focus:border-accent"
        />
      </label>

      {/* Honeypot : invisible aux humains comme aux lecteurs d'écran. */}
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

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || rating === null}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
      >
        {pending ? fr.review.submitting : fr.review.submit}
      </button>
    </form>
  );
}
