import { fr } from '@/lib/i18n/fr';

/**
 * Affichage d'une note en étoiles.
 *
 * Les étoiles sont décoratives (`aria-hidden`) et doublées d'un libellé
 * textuel lu par les lecteurs d'écran : « ★★★★☆ » seul n'a aucun sens à
 * l'oral, et le nombre est de toute façon l'information utile.
 */
export function Stars({
  rating,
  size = 'md',
}: {
  rating: number;
  size?: 'sm' | 'md';
}) {
  const rounded = Math.round(rating);
  const classes = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <span className={`inline-flex items-center gap-0.5 ${classes}`}>
      <span aria-hidden="true" className="text-accent">
        {'★'.repeat(rounded)}
        <span className="text-border">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span className="sr-only">
        {rating} {rating > 1 ? fr.review.stars : fr.review.star} sur 5
      </span>
    </span>
  );
}

/** Note moyenne + nombre d'avis. N'affiche rien si le salon n'a aucun avis. */
export function RatingBadge({
  average,
  count,
  size = 'md',
}: {
  average: number | null;
  count: number;
  size?: 'sm' | 'md';
}) {
  // `average` null = aucun avis. Afficher « 0/5 » pénaliserait injustement un
  // salon qui vient d'ouvrir : on n'affiche simplement rien.
  if (average === null || count === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Stars rating={average} size={size} />
      <span
        className={`font-medium ${size === 'sm' ? 'text-sm' : ''}`}
        aria-hidden="true"
      >
        {average.toLocaleString('fr-FR')}
      </span>
      <span className={`text-muted ${size === 'sm' ? 'text-sm' : ''}`}>
        ({count})
      </span>
    </span>
  );
}
