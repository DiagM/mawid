import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import {
  PLAN_LABELS,
  REQUIRED_PLAN,
  type GatedModule,
} from '@/lib/plans';

/**
 * Écran d'un module non compris dans l'offre du salon.
 *
 * Affiché à la place du contenu, et non d'une page d'erreur : un gérant qui
 * tombe sur un 403 conclut à une panne. Ici il apprend que le module existe,
 * ce qu'il fait, et ce qu'il coûte — c'est le seul endroit du produit où un
 * refus a une chance de devenir une vente.
 */
export function PlanLocked({ module }: { module: GatedModule }) {
  const required = PLAN_LABELS[REQUIRED_PLAN[module]];
  const content = fr.pro.locked.modules[module];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="rounded-xl border border-accent bg-surface p-6">
        <p className="text-sm font-medium text-accent">
          {fr.pro.locked.badge.replace('{plan}', required)}
        </p>

        <h1 className="mt-2 text-xl font-semibold">{content.title}</h1>
        <p className="mt-2 text-muted">{content.body}</p>

        <ul className="mt-4 space-y-2 text-sm">
          {content.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span aria-hidden className="text-accent">
                ✓
              </span>
              {bullet}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-muted">
          {fr.pro.locked.contact.replace('{plan}', required)}
        </p>

        {/* Un refus sans suite ne vend rien : le lien emmene sur la page
            contact avec la demande deja formulee et l'offre pre-remplie. */}
        <Link
          href={`/contact?sujet=offre&offre=${REQUIRED_PLAN[module]}`}
          className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white"
        >
          {fr.pro.locked.cta.replace('{plan}', required)}
        </Link>
      </div>
    </main>
  );
}
