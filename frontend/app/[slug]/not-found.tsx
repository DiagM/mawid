import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';

export default function SalonNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">{fr.salon.notFound}</h1>
      <p className="mt-2 text-muted">{fr.salon.notFoundHelp}</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 font-medium"
      >
        <Logo size="sm" />
      </Link>
    </main>
  );
}
