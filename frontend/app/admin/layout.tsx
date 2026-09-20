import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { requireAdminToken } from '@/lib/session';

export const metadata: Metadata = {
  title: { default: fr.admin.title, template: `%s · ${fr.admin.title}` },
  // Jamais indexée : une console d'administration qui apparaît dans Google
  // est une invitation à en chercher la faille.
  robots: { index: false, follow: false },
};

/**
 * Coquille de la console d'administration.
 *
 * Contrairement au layout du back-office gérant, celui-ci APPELLE bien
 * `requireAdminToken()` — non pas comme barrière de sécurité (chaque page et
 * chaque Server Action refont le contrôle, et le backend tranche en dernier
 * ressort), mais pour éviter d'afficher une navigation d'administration à qui
 * n'y a pas droit.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminToken();

  const links = [
    { href: '/admin', label: fr.admin.nav.overview },
    { href: '/admin/gerants', label: fr.admin.nav.managers },
    { href: '/admin/avis', label: fr.admin.nav.reviews },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold text-accent">
            {fr.admin.title}
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-bg hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
            {/* Vers le site public et non vers `/pro` : un fondateur n'a
                pas de salon, et `/pro` le renverrait aussitôt ici — un lien
                qui semble ne rien faire. Voir la plateforme telle que la
                voient les clientes est en revanche toujours utile. */}
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-bg hover:text-fg"
            >
              {fr.admin.nav.publicSite}
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
