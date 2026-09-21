import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';
import { getSessionToken } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: fr.pro.login,
  // Aucun écran du back-office n'a vocation à être indexé.
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Déjà connecté : inutile de redemander des identifiants.
  if (await getSessionToken()) {
    redirect('/pro');
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-1">
        <Logo size="md" />
      </h1>
      <p className="mb-8 mt-1 text-muted">{fr.pro.loginSubtitle}</p>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-muted">
        {fr.pro.noAccount}{' '}
        <Link
          href="/pro/inscription"
          className="text-accent underline underline-offset-4"
        >
          {fr.pro.createAccount}
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
