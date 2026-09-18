import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, getPublicSalon, type PublicSalon } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { getRequestOrigin } from '@/lib/request-origin';
import { BookingFlow } from './booking-flow';

type PageProps = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: fr.booking.title,
  // Le tunnel de réservation n'a aucune valeur en résultat de recherche, et
  // indexer des pages d'état intermédiaire nuirait au référencement des fiches.
  robots: { index: false, follow: true },
};

/** try/catch autour de la donnée uniquement, jamais autour du JSX. */
async function loadSalon(slug: string): Promise<PublicSalon> {
  try {
    return await getPublicSalon(slug);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }
    throw error;
  }
}

export default async function BookingPage({ params }: PageProps) {
  const { slug } = await params;
  const [salon, origin] = await Promise.all([
    loadSalon(slug),
    getRequestOrigin(),
  ]);

  // Sans prestation, il n'y a rien à réserver : on renvoie vers le 404 plutôt
  // que d'afficher un tunnel vide.
  if (salon.prestations.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6">
      <BookingFlow salon={salon} origin={origin} />
    </main>
  );
}
