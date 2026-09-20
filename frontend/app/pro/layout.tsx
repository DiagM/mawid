import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate } from '@/lib/format';
import { getMySalon, getQuota, type QuotaStatus } from '@/lib/api-pro';
import { getSessionToken } from '@/lib/session';
import { hasModule, PLAN_LABELS, REQUIRED_PLAN } from '@/lib/plans';
import { logoutAction } from './actions';

export const metadata: Metadata = {
  title: { default: fr.pro.title, template: `%s · ${fr.pro.title}` },
  robots: { index: false, follow: false },
};

/**
 * Coquille du back-office.
 *
 * ⚠️ Ce layout n'est PAS une barrière de sécurité : il affiche seulement la
 * navigation quand une session existe. La protection réelle est faite par
 * `requireSessionToken()` dans chaque page et chaque Server Action — une
 * Server Action étant joignable par POST direct, un contrôle unique ici ne
 * protégerait rien.
 */
export default async function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();
  const hasSession = Boolean(token);

  // Un salon inscrit en self-service reste invisible jusqu'à validation. Sans
  // ce bandeau, le gérant préparerait son agenda en attendant des clients qui
  // ne peuvent pas le trouver — et conclurait que le produit ne marche pas.
  let isPending = false;
  // Le quota bloque des réservations : le gérant doit le voir depuis
  // n'importe quel écran, pas seulement en allant le chercher.
  let quota: QuotaStatus | null = null;

  if (token) {
    try {
      const [salon, quotaStatus] = await Promise.all([
        getMySalon(token),
        getQuota(token),
      ]);
      isPending = !salon.isActive;
      quota = quotaStatus;
    } catch {
      // Jeton expiré ou backend injoignable : les pages elles-mêmes
      // redirigeront proprement, inutile de casser le layout ici.
      isPending = false;
      quota = null;
    }
  }

  // `quota` porte déjà l'offre du salon : pas de requête supplémentaire.
  // Sans session ou backend injoignable, on n'affiche aucun verrou plutôt
  // que d'en inventer un.
  const plan = quota?.plan ?? null;
  const clientsLock =
    plan && !hasModule(plan, 'clients')
      ? PLAN_LABELS[REQUIRED_PLAN.clients]
      : null;
  const cashLock =
    plan && !hasModule(plan, 'cash') ? PLAN_LABELS[REQUIRED_PLAN.cash] : null;
  const stockLock =
    plan && !hasModule(plan, 'stock') ? PLAN_LABELS[REQUIRED_PLAN.stock] : null;

  return (
    <div className="flex min-h-full flex-col">
      {hasSession && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/pro" className="font-semibold text-accent">
              {fr.app.name}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-muted underline underline-offset-4"
              >
                {fr.pro.signOut}
              </button>
            </form>
          </div>

          <nav className="mx-auto max-w-3xl overflow-x-auto px-4">
            <ul className="flex gap-1 pb-2">
              <NavLink href="/pro" label={fr.pro.nav.agenda} />
              <NavLink href="/pro/salon" label={fr.pro.nav.salon} />
              <NavLink href="/pro/prestations" label={fr.pro.nav.prestations} />
              <NavLink href="/pro/equipe" label={fr.pro.nav.team} />
              <NavLink href="/pro/avis" label={fr.pro.nav.reviews} />
              {/* Les modules hors offre restent VISIBLES, marqués de l'offre
                  qui les débloque. Les masquer priverait le gérant de toute
                  raison de monter en gamme — il ignorerait jusqu'à leur
                  existence. */}
              <NavLink
                href="/pro/clients"
                label={fr.pro.nav.clients}
                lockedBy={clientsLock}
              />
              <NavLink
                href="/pro/campagnes"
                label={fr.pro.nav.campaigns}
                lockedBy={clientsLock}
              />
              <NavLink
                href="/pro/caisse"
                label={fr.pro.nav.cash}
                lockedBy={cashLock}
              />
              <NavLink
                href="/pro/stock"
                label={fr.pro.nav.stock}
                lockedBy={stockLock}
              />
              <NavLink href="/pro/statistiques" label={fr.pro.nav.stats} />
              <NavLink
                href="/pro/indisponibilites"
                label={fr.pro.nav.blocked}
              />
            </ul>
          </nav>
        </header>
      )}

      {isPending && (
        <div className="border-b border-border bg-accent-soft px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <p className="font-medium text-accent">
              {fr.pro.register.pendingTitle}
            </p>
            <p className="mt-1 text-sm">{fr.pro.register.pendingHelp}</p>
          </div>
        </div>
      )}

      {quota && (quota.isExceeded || quota.isNearLimit) && (
        <QuotaBanner quota={quota} />
      )}

      {children}
    </div>
  );
}

/**
 * Alerte de quota.
 *
 * Deux niveaux volontairement distincts : « bientôt à court » laisse le temps
 * de réagir, « limite atteinte » signale que des clients sont déjà refusés.
 * Confondre les deux ferait manquer la fenêtre où le gérant peut encore agir.
 */
function QuotaBanner({ quota }: { quota: QuotaStatus }) {
  const resetDate = formatLongDate(quota.resetsAt.slice(0, 10));

  if (quota.isExceeded) {
    return (
      <div className="border-b border-border bg-danger-soft px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <p className="font-medium text-danger">
            {fr.pro.quota.exceededTitle}
          </p>
          <p className="mt-1 text-sm">{fr.pro.quota.exceeded}</p>
          <p className="mt-1 text-sm text-muted">
            {fr.pro.quota.resets.replace('{date}', resetDate)}{' '}
            {fr.pro.quota.upgrade}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-accent-soft px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <p className="font-medium text-accent">{fr.pro.quota.nearLimitTitle}</p>
        <p className="mt-1 text-sm">
          {fr.pro.quota.nearLimit.replace(
            '{remaining}',
            String(quota.remaining ?? 0),
          )}
        </p>
        <p className="mt-1 text-sm text-muted">
          {fr.pro.quota.resets.replace('{date}', resetDate)}{' '}
          {fr.pro.quota.upgrade}
        </p>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  lockedBy = null,
}: {
  href: string;
  label: string;
  /** Nom de l'offre qui débloque ce module, ou `null` s'il est ouvert. */
  lockedBy?: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`block shrink-0 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-soft hover:text-accent ${
          lockedBy ? 'text-muted/60' : 'text-muted'
        }`}
      >
        {label}
        {lockedBy && (
          <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal">
            {lockedBy}
          </span>
        )}
      </Link>
    </li>
  );
}
