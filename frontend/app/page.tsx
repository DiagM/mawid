import Link from 'next/link';
import { searchSalons, type SalonSearchResult } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { formatPrice } from '@/lib/format';

type PageProps = {
  searchParams: Promise<{ q?: string; womenOnly?: string }>;
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

  let results: SalonSearchResult | null = null;
  try {
    results = await searchSalons({
      city: 'Alger',
      q: query || undefined,
      womenOnly,
    });
  } catch {
    // Backend injoignable : on affiche la recherche plutôt qu'une page
    // d'erreur, l'utilisateur peut réessayer sans perdre sa saisie.
    results = null;
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-accent">
          {fr.app.name}
        </h1>
        <p className="mt-2 text-muted">{fr.app.tagline}</p>
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
                    <div>
                      <h2 className="font-medium">{salon.name}</h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {salon.district}, {salon.city}
                      </p>
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
    </main>
  );
}
