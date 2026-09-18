import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fr } from '@/lib/i18n/fr';
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
      <h1 className="text-2xl font-semibold tracking-tight text-accent">
        {fr.app.name}
      </h1>
      <p className="mb-8 mt-1 text-muted">{fr.pro.loginSubtitle}</p>

      <LoginForm />
    </main>
  );
}
