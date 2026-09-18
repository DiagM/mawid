import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { getSessionToken } from '@/lib/session';
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
  const hasSession = Boolean(await getSessionToken());

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
              <NavLink
                href="/pro/indisponibilites"
                label={fr.pro.nav.blocked}
              />
            </ul>
          </nav>
        </header>
      )}

      {children}
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-accent-soft hover:text-accent"
      >
        {label}
      </Link>
    </li>
  );
}
