import type { Metadata } from 'next';
import { Aref_Ruqaa, Marcellus } from 'next/font/google';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';
import './globals.css';

/**
 * 404 des URL qui ne correspondent à aucune route.
 *
 * Next court-circuite le rendu normal pour ces adresses : ce fichier doit
 * donc renvoyer un document HTML COMPLET et réimporter lui-même styles et
 * polices. C'est la contrepartie documentée de `experimental.globalNotFound`,
 * et la raison pour laquelle ce fichier duplique une partie de `layout.tsx`.
 *
 * `app/not-found.tsx` reste utile et n'est pas remplacé : il sert les appels
 * à `notFound()` faits DANS une route existante, et hérite du layout normal.
 */

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-marcellus',
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-aref-ruqaa',
});

export const metadata: Metadata = {
  title: `${fr.notFound.title} · ${fr.app.name}`,
  // Une page d'erreur n'a rien à faire dans un index de recherche, même
  // quand l'indexation du site sera ouverte.
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html
      lang="fr"
      className={`h-full antialiased ${marcellus.variable} ${arefRuqaa.variable}`}
    >
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <Logo size="lg" />

          <h1 className="mt-8 text-xl font-semibold">{fr.notFound.title}</h1>
          <p className="mt-2 leading-relaxed text-muted">{fr.notFound.help}</p>

          <Link
            href="/"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {fr.notFound.search}
          </Link>

          <Link
            href="/pour-les-salons"
            className="mt-6 text-sm text-muted underline underline-offset-4 hover:text-accent"
          >
            {fr.notFound.forSalons}
          </Link>
        </main>
      </body>
    </html>
  );
}
