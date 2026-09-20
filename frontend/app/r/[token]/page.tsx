import type { Metadata } from 'next';
import {
  ApiError,
  getReservationByToken,
  type ReservationView,
} from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { ManageReservation } from './manage-reservation';
import { ReviewForm } from './review-form';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: fr.manage.title,
  // Le token est un secret porteur : cette page ne doit JAMAIS être indexée,
  // ni transmise en referrer vers un site tiers.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

/**
 * Le try/catch entoure uniquement la récupération de données, jamais du JSX :
 * React ne rend pas les composants au moment où le JSX est construit, donc une
 * erreur de rendu ne serait pas attrapée ici (règle react-hooks/error-boundaries).
 */
interface LoadedReservation {
  reservation: ReservationView;
  /**
   * Calculé ici et non pendant le rendu : `Date.now()` est une fonction
   * impure, interdite dans le corps d'un composant (`react-hooks/purity`).
   */
  isUpcoming: boolean;
}

async function loadReservation(
  token: string,
): Promise<LoadedReservation | null> {
  try {
    const reservation = await getReservationByToken(token);
    return {
      reservation,
      isUpcoming: new Date(reservation.startsAt).getTime() > Date.now(),
    };
  } catch (error) {
    // Un token invalide et un token expiré donnent le même écran : inutile
    // d'aider quiconque à distinguer les deux.
    if (error instanceof ApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
}

export default async function ManagePage({ params }: PageProps) {
  const { token } = await params;
  const loaded = await loadReservation(token);

  if (!loaded) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{fr.manage.notFound}</h1>
        <p className="mt-2 text-muted">{fr.manage.notFoundHelp}</p>
      </main>
    );
  }

  const { reservation } = loaded;
  // Le formulaire n'apparaît que pour un passage réellement honoré et pas
  // encore noté. Le serveur revérifie ces deux conditions : un POST direct
  // ne contourne rien.
  const canReview =
    reservation.status === 'HONORED' && reservation.hasReview !== true;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <ManageReservation
        reservation={reservation}
        token={token}
        isUpcoming={loaded.isUpcoming}
      />

      {canReview && (
        <div className="mt-6">
          <ReviewForm token={token} />
        </div>
      )}

      {reservation.hasReview === true && (
        <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
          {fr.review.already}
        </p>
      )}
    </main>
  );
}
