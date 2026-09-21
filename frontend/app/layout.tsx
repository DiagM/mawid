import type { Metadata, Viewport } from 'next';
import { Aref_Ruqaa, Marcellus } from 'next/font/google';
import { fr } from '@/lib/i18n/fr';
import './globals.css';

/**
 * Deux polices, chargées par `next/font` : les fichiers sont téléchargés au
 * BUILD et servis depuis notre domaine. Aucun appel à Google au chargement,
 * donc la décision d'origine — ne dépendre d'aucun tiers dans le chemin
 * critique — tient toujours.
 *
 * `display: swap` : le texte s'affiche immédiatement en police système, puis
 * bascule. Sur une connexion mobile algérienne, mieux vaut une transition
 * visible qu'une page blanche.
 */
const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-marcellus',
});

/** Calligraphie Ruq'ah du logo موعد. Sous-ensemble arabe uniquement. */
const arefRuqaa = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-aref-ruqaa',
});

export const metadata: Metadata = {
  title: {
    default: `${fr.app.name} — ${fr.app.tagline}`,
    template: `%s · ${fr.app.name}`,
  },
  description:
    'Réservez votre rendez-vous chez les salons de beauté et barbershops à Alger, sans créer de compte.',
};

export const viewport: Viewport = {
  // Le produit est mobile-first et utilisé debout, souvent au soleil :
  // on laisse le zoom disponible plutôt que de le verrouiller.
  width: 'device-width',
  initialScale: 1,
  themeColor: '#a84b28',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`h-full antialiased ${marcellus.variable} ${arefRuqaa.variable}`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
