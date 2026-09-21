import Link from 'next/link';
import { Suspense } from 'react';
import { searchSalons, type SalonSearchResult } from '@/lib/api';
import { formatDistance } from '@/lib/geo';
import { NearbyButton } from '@/components/nearby-button';
import { fr } from '@/lib/i18n/fr';
import { formatPrice } from '@/lib/format';
import { RatingBadge } from '@/components/stars';
import { Logo } from '@/components/logo';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    womenOnly?: string;
    lat?: string;
    lng?: string;
  }>;
};

/**
 * Accueil et recherche.
 *
 * Formulaire en GET plutôt qu'en Server Action : une recherche doit produire
 * une URL partageable et rechargeable, indexable par les moteurs. C'est un
 * canal d'acquisition, pas une mutation.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const womenOnly = params.womenOnly === 'true';
  // Les deux coordonnees vont ensemble : une seule ferait trier par
  // rapport a un point pose sur l'equateur.
  const position = readPosition(params.lat, params.lng);

  let results: SalonSearchResult | null = null;
  try {
    results = await searchSalons({
      city: 'Alger',
      q: query || undefined,
      womenOnly,
      lat: position?.lat,
      lng: position?.lng,
    });
  } catch {
    // Backend injoignable : on affiche la recherche plutôt qu'une page
    // d'erreur, l'utilisateur peut réessayer sans perdre sa saisie.
    results = null;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 flex flex-col items-center text-center">
        <h1>
          <Logo size="lg" />
        </h1>
        <p className="mt-3 text-muted">{fr.app.tagline}</p>
      </header>

      <form method="get" className="mb-8">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={fr.search.placeholder}
            aria-label={fr.search.title}
            className="h-12 flex-1 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-xl bg-accent px-5 font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {fr.search.submit}
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="womenOnly"
            value="true"
            defaultChecked={womenOnly}
            className="size-4"
          />
          <span>{fr.search.womenOnly}</span>
        </label>
      </form>

      {/* Hors du <form> : ce bouton ne soumet rien, il remplace l'URL
          apres avoir obtenu l'accord de la cliente. */}
      <Suspense fallback={null}>
        <NearbyButton />
      </Suspense>

      {results === null ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.common.networkError}
        </p>
      ) : results.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p>{fr.search.empty}</p>
          <p className="mt-1 text-sm text-muted">{fr.search.emptyHelp}</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {results.total}{' '}
            {results.total > 1 ? fr.search.resultsPlural : fr.search.results}
          </p>

          <ul className="space-y-2">
            {results.items.map((salon) => (
              <li key={salon.slug}>
                <Link
                  href={`/${salon.slug}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Vignette : `photos[0]`, celle que le gérant a choisie
                        comme vitrine. Une liste de résultats sans image se
                        parcourt beaucoup moins dans un secteur qui se vend à
                        l'œil. */}
                    {salon.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={salon.photo}
                        alt=""
                        loading="lazy"
                        className="size-20 shrink-0 rounded-lg border border-border object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      {/*
                        La mise en avant est annoncée explicitement : un
                        classement payant non signalé tromperait le client sur
                        la raison de ce premier rang.
                      */}
                      {salon.isFeatured && (
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">
                          {fr.search.featured}
                        </p>
                      )}
                      <h2 className="font-medium">{salon.name}</h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {salon.district}, {salon.city}
                        {salon.distanceMeters !== null && (
                          <>
                            {' · '}
                            <span className="font-medium text-accent">
                              {formatDistance(salon.distanceMeters)}
                            </span>
                          </>
                        )}
                      </p>
                      <div className="mt-1">
                        <RatingBadge
                          average={salon.rating.average}
                          count={salon.rating.count}
                          size="sm"
                        />
                      </div>
                    </div>

                    {salon.isWomenOnly && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                        {fr.salon.womenOnly}
                      </span>
                    )}
                  </div>

                  {salon.fromPriceCents !== null && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted">{fr.search.from} </span>
                      <span className="font-semibold text-accent">
                        {formatPrice(salon.fromPriceCents)}
                      </span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Le seul lien B2B de la page cliente : discret, en pied, mais présent.
          Un gérant qui découvre Mawid arrive presque toujours par la fiche
          d'un confrère ou par cette recherche, pas par une publicité. */}
      <footer className="mt-12 border-t border-border pt-6 text-center">
        <Link
          href="/pour-les-salons"
          className="text-sm text-muted underline underline-offset-4 hover:text-accent"
        >
          {fr.search.forSalons}
        </Link>
        <span aria-hidden className="mx-2 text-border">·</span>
        <Link
          href="/contact"
          className="text-sm text-muted underline underline-offset-4 hover:text-accent"
        >
          {fr.search.contact}
        </Link>
      </footer>
    </main>
  );
}

/**
 * Position lue dans l'URL.
 *
 * Elle vient d'un paramètre public : n'importe qui peut la forger. On refuse
 * donc tout ce qui n'est pas un couple de nombres dans les bornes du globe,
 * plutôt que de laisser le backend arbitrer — il renverrait une 400, et la
 * page de recherche afficherait une erreur là où il suffit d'ignorer.
 */
function readPosition(
  lat?: string,
  lng?: string,
): { lat: number; lng: number } | null {
  if (lat === undefined || lng === undefined) {
    return null;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  return valid ? { lat: latitude, lng: longitude } : null;
}
