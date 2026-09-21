import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';

/**
 * Page 404 de la racine.
 *
 * Les fiches salon et les rendez-vous ont déjà la leur ; celle-ci attrape
 * tout le reste — une URL mal recopiée, un lien mort partagé sur WhatsApp,
 * un signet d'un salon qui a quitté Mawid. Sans elle, Next sert sa page par
 * défaut, en anglais, sur un produit entièrement en français.
 *
 * On propose la recherche plutôt qu'un simple retour à l'accueil : la
 * personne cherchait un salon, autant la remettre sur ce chemin.
 */
export default function NotFound() {
  return (
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
  );
}
