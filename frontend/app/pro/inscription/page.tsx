import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fr } from '@/lib/i18n/fr';
import { getSessionToken } from '@/lib/session';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: fr.pro.register.title,
  description:
    'Inscrivez votre salon sur Mawid et recevez des réservations en ligne, gratuitement.',
  // Seule page du back-office indexable : c'est une page d'acquisition côté
  // professionnels, pas un écran de gestion.
  robots: { index: true, follow: true },
};

export default async function RegisterPage() {
  if (await getSessionToken()) {
    redirect('/pro');
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-accent">
        {fr.pro.register.title}
      </h1>
      <p className="mb-8 mt-1 text-muted">{fr.pro.register.subtitle}</p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted">
        {fr.pro.haveAccount}{' '}
        <Link
          href="/pro/connexion"
          className="text-accent underline underline-offset-4"
        >
          {fr.pro.backToLogin}
        </Link>
      </p>
      <p className="mt-3 text-center text-sm">
        <Link
          href="/pour-les-salons"
          className="text-muted underline underline-offset-4"
        >
          {fr.pro.discoverMawid}
        </Link>
      </p>
    </main>
  );
}
