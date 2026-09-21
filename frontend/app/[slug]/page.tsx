import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { notFound } from 'next/navigation';
import {
  ApiError,
  getPublicSalon,
  getSalonReviews,
  type PublicSalon,
  type SalonReviews,
} from '@/lib/api';
import { fr, type WeekdayKey } from '@/lib/i18n/fr';
import { formatDuration, formatPhone, formatPrice } from '@/lib/format';
import { salonJsonLd, serializeJsonLd } from '@/lib/json-ld';
import { RatingBadge, Stars } from '@/components/stars';
import { siteUrl } from '@/lib/site-url';

/** Ordre d'affichage : semaine algérienne, qui commence le dimanche. */
const WEEK_ORDER: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * `params` est une Promise dans cette version de Next : il faut l'attendre.
 * (node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md)
 */
type PageProps = { params: Promise<{ slug: string }> };

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const salon = await getPublicSalon(slug);
    return {
      title: salon.name,
      description:
        salon.description ??
        `Réservez chez ${salon.name}, ${salon.district} — ${salon.city}.`,
      alternates: { canonical: `${siteUrl()}/${slug}` },
      openGraph: {
        title: salon.name,
        description: `${salon.district}, ${salon.city}`,
        type: 'website',
      },
    };
  } catch {
    // Une fiche introuvable ne doit pas faire échouer le rendu des métadonnées :
    // la page elle-même se chargera de renvoyer un 404 propre.
    return { title: fr.salon.notFound };
  }
}

export default async function SalonPage({ params }: PageProps) {
  const { slug } = await params;
  const salon = await loadSalon(slug);

  // Les avis ne doivent pas faire échouer la fiche : un salon reste
  // consultable et réservable même si cette requête échoue.
  let reviews: SalonReviews | null = null;
  try {
    reviews = await getSalonReviews(slug);
  } catch {
    reviews = null;
  }

  const canonical = `${siteUrl()}/${salon.slug}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      {/* Un visiteur arrive ici depuis Google, jamais par l'accueil : sans
          ce lien il n'a aucun moyen de découvrir les autres salons, ni même
          de comprendre sur quelle plateforme il se trouve. */}
      <Link href="/" className="mb-6 inline-block">
        <Logo size="sm" />
      </Link>

      {/*
        Données structurées : c'est ce qui fait remonter adresse, horaires et
        fourchette de prix dans les résultats Google. Pour un salon sans site
        web, c'est son seul référencement.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(salonJsonLd(salon, canonical)),
        }}
      />

      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {salon.name}
            </h1>
            <p className="mt-1 text-muted">
              {salon.addressLine}, {salon.district} — {salon.city}
            </p>
            <div className="mt-2">
              <RatingBadge
                average={salon.rating.average}
                count={salon.rating.count}
              />
            </div>
          </div>
          {salon.isWomenOnly && (
            <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
              {fr.salon.womenOnly}
            </span>
          )}
        </div>

        {salon.description && (
          <p className="mt-4 leading-relaxed text-muted">{salon.description}</p>
        )}

        <a
          href={`tel:${salon.contactPhone}`}
          className="mt-4 inline-flex items-center gap-2 text-accent underline underline-offset-4"
        >
          {formatPhone(salon.contactPhone)}
        </a>
      </header>

      {salon.photos.length > 0 && (
        <section aria-label={fr.salon.photos} className="mb-8">
          {/* Bande défilante plutôt qu'une grille : sur téléphone — d'où
              vient la quasi-totalité du trafic — une grille rétrécirait
              chaque photo au point de ne plus rien montrer. */}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {salon.photos.map((photo, index) => (
              <li
                key={photo}
                className="w-64 shrink-0 snap-start overflow-hidden rounded-xl border border-border"
              >
                {/* `img` et non `next/image` : ces URL viennent d'un
                    hébergeur externe et l'optimiseur de Next les ferait
                    toutes transiter par le serveur. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt=""
                  // La première est visible d'emblée, les suivantes non :
                  // les charger toutes ralentirait l'affichage du prix et
                  // des créneaux, qui sont la vraie raison de la visite.
                  loading={index === 0 ? 'eager' : 'lazy'}
                  className="aspect-[4/3] w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="prestations" className="mb-8">
        <h2 id="prestations" className="mb-3 text-lg font-semibold rule-gold">
          {fr.salon.services}
        </h2>

        {salon.prestations.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-muted">
            {fr.salon.noServices}
          </p>
        ) : (
          <ul className="space-y-2">
            {salon.prestations.map((prestation) => (
              <li
                key={prestation.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-medium">{prestation.name}</h3>
                  <span className="shrink-0 font-semibold text-accent">
                    {formatPrice(prestation.priceCents)}
                  </span>
                </div>
                {prestation.description && (
                  <p className="mt-1 text-sm text-muted">
                    {prestation.description}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted">
                  {formatDuration(prestation.durationMinutes)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="horaires" className="mb-8">
        <h2 id="horaires" className="mb-3 text-lg font-semibold rule-gold">
          {fr.salon.openingHours}
        </h2>
        <dl className="overflow-hidden rounded-xl border border-border bg-surface">
          {WEEK_ORDER.map((day) => {
            const hours = salon.openingHours?.[day];
            return (
              <div
                key={day}
                className="flex justify-between border-b border-border px-4 py-2.5 text-sm last:border-b-0"
              >
                <dt>{fr.weekdays[day]}</dt>
                <dd className={hours ? '' : 'text-muted'}>
                  {hours ? `${hours.open} – ${hours.close}` : fr.salon.closed}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="avis" className="mb-8">
        <h2 id="avis" className="mb-3 text-lg font-semibold">
          {fr.review.reviewsTitle}
        </h2>

        {!reviews || reviews.items.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-muted">{fr.review.noReviews}</p>
            <p className="mt-1 text-sm text-muted">
              {fr.review.noReviewsHelp}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reviews.items.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{review.clientFirstName}</span>
                  <Stars rating={review.rating} size="sm" />
                </div>

                {review.employeeName && (
                  <p className="mt-0.5 text-sm text-muted">
                    {fr.review.with} {review.employeeName}
                  </p>
                )}

                {review.comment && (
                  <p className="mt-2 leading-relaxed">{review.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Barre d'action fixe : sur mobile, l'action principale doit rester
        accessible au pouce sans avoir à remonter toute la liste des
        prestations. C'est le seul chemin vers la conversion.
      */}
      {salon.prestations.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Link
              href={`/${salon.slug}/reserver`}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {fr.salon.book}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
