import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { siteUrl } from '@/lib/site-url';

/**
 * ============================================
 * Page de présentation aux salons
 * ============================================
 * La seule page du produit qui s'adresse au gérant et non à sa cliente.
 *
 * Elle vit à la racine et non sous `/pro` pour deux raisons : `/pro` est le
 * back-office, dont le layout impose `noindex` — or c'est précisément ici
 * qu'il faut être trouvé sur Google ; et un prospect qui atterrit sur un
 * écran de connexion referme l'onglet.
 *
 * ⚠️ Le slug `pour-les-salons` est réservé côté backend
 * (`common/slug.ts`) : sans cela, un salon pourrait obtenir ce slug et
 * devenir inaccessible, Next donnant la priorité à cette route statique sur
 * la route dynamique `[slug]`.
 */

export const metadata: Metadata = {
  title: fr.landing.metaTitle,
  description: fr.landing.metaDescription,
  alternates: { canonical: `${siteUrl()}/pour-les-salons` },
  openGraph: {
    title: fr.landing.metaTitle,
    description: fr.landing.metaDescription,
    url: `${siteUrl()}/pour-les-salons`,
    type: 'website',
  },
};

export default function ForSalonsPage() {
  return (
    <main className="w-full">
      {/* ---- Accroche ---- */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-accent underline underline-offset-4"
          >
            {fr.app.name}
          </Link>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            {fr.landing.heroTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            {fr.landing.heroSubtitle}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pro/inscription"
              className="flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-accent px-6 font-semibold text-white sm:w-auto"
            >
              {fr.landing.heroCta}
            </Link>
            <Link
              href="/pro/connexion"
              className="flex h-12 w-full max-w-xs items-center justify-center rounded-xl border border-border px-6 font-medium sm:w-auto"
            >
              {fr.landing.heroSecondary}
            </Link>
          </div>

          <p className="mt-4 text-sm text-muted">{fr.landing.heroNote}</p>
        </div>
      </section>

      {/* ---- Bénéfices ---- */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="mb-6 text-xl font-semibold">
          {fr.landing.problemTitle}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {fr.landing.problems.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---- Fonctionnalités ---- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <h2 className="mb-6 text-xl font-semibold">
            {fr.landing.featuresTitle}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {fr.landing.features.map((item) => (
              <article key={item.title}>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Tarifs ---- */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="mb-2 text-xl font-semibold">
          {fr.landing.pricingTitle}
        </h2>
        <p className="mb-6 text-sm text-muted">{fr.landing.pricingNote}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard
            name={fr.landing.planFreeName}
            price={fr.landing.planFreePrice}
            period={fr.landing.planFreePeriod}
            limit={fr.landing.planFreeLimit}
          />
          <PlanCard
            name={fr.landing.planProName}
            price={fr.landing.planProPrice}
            period={fr.landing.planProPeriod}
            limit={fr.landing.planProLimit}
            highlighted
          />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 font-medium">{fr.landing.planIncluded}</p>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            {fr.landing.planFeatures.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Le quota refuse des clientes réelles : l'annoncer ici évite que le
            gérant le découvre le jour où une réservation est bloquée. */}
        <p className="mt-4 text-sm text-muted">{fr.landing.quotaWarning}</p>
      </section>

      {/* ---- Démarrage ---- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <h2 className="mb-6 text-xl font-semibold">
            {fr.landing.stepsTitle}
          </h2>

          <ol className="space-y-4">
            {fr.landing.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Questions ---- */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="mb-6 text-xl font-semibold">{fr.landing.faqTitle}</h2>

        <div className="space-y-3">
          {fr.landing.faq.map((entry) => (
            <details
              key={entry.question}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <summary className="cursor-pointer font-medium">
                {entry.question}
              </summary>
              <p className="mt-2 text-sm text-muted">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---- Rappel final ---- */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
          <h2 className="text-xl font-semibold">{fr.landing.finalTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {fr.landing.finalBody}
          </p>
          <Link
            href="/pro/inscription"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-8 font-semibold text-white"
          >
            {fr.landing.heroCta}
          </Link>
        </div>
      </section>
    </main>
  );
}

function PlanCard({
  name,
  price,
  period,
  limit,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  limit: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-5 ${
        highlighted ? 'border-accent' : 'border-border'
      }`}
    >
      <p className="font-medium">{name}</p>
      <p className="mt-2 text-3xl font-semibold">{price}</p>
      <p className="text-sm text-muted">{period}</p>
      <p className="mt-3 text-sm">{limit}</p>
    </div>
  );
}
