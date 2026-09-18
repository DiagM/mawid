import type { Metadata, Viewport } from 'next';
import { fr } from '@/lib/i18n/fr';
import './globals.css';

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
  themeColor: '#1f6f5c',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
