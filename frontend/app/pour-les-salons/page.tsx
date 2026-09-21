import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';
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
          <Link href="/" className="inline-block">
            <Logo size="md" />
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
        <h2 className="mb-6 text-xl font-semibold rule-gold">
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
          <h2 className="mb-6 text-xl font-semibold rule-gold">
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
        <h2 className="mb-2 text-xl font-semibold rule-gold">
          {fr.landing.pricingTitle}
        </h2>
        <p className="mb-6 text-sm text-muted">{fr.landing.pricingNote}</p>

        {/* Trois colonnes sur grand écran, empilées sur téléphone. Le
            deuxième palier est mis en avant : c'est celui vers lequel la
            plupart des salons basculent, et une grille sans repère laisse le
            lecteur choisir le moins cher par défaut. */}
        <div className="grid gap-4 lg:grid-cols-3">
          {fr.landing.plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`rounded-xl border bg-surface p-5 ${
                index === 1 ? 'border-accent' : 'border-border'
              }`}
            >
              {index === 1 && (
                <p className="mb-2 text-xs font-medium text-accent">
                  {fr.landing.popular}
                </p>
              )}

              <p className="font-medium">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold">{plan.price}</p>
              <p className="text-sm text-muted">{plan.period}</p>
              <p className="mt-3 text-sm font-medium">{plan.pitch}</p>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="shrink-0 text-accent">
                      ✓
                    </span>
                    <span className="text-muted">{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Le quota refuse des clientes réelles : l'annoncer ici évite que le
            gérant le découvre le jour où une réservation est bloquée. */}
        <p className="mt-4 text-sm text-muted">{fr.landing.quotaWarning}</p>
      </section>

      {/* ---- Démarrage ---- */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <h2 className="mb-6 text-xl font-semibold rule-gold">
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
        <h2 className="mb-6 text-xl font-semibold rule-gold">{fr.landing.faqTitle}</h2>

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
