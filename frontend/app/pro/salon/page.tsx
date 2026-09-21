import type { Metadata } from 'next';
import Link from 'next/link';
import { getMySalon } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { SalonForm } from './salon-form';
import { PhotoManager } from './photo-manager';

export const metadata: Metadata = { title: fr.pro.salon.title };

export default async function SalonSettingsPage() {
  const token = await requireSessionToken();
  const salon = await getMySalon(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.salon.title}</h1>

      <p className="mb-6 text-sm text-muted">
        {fr.pro.salon.publicLink} :{' '}
        <Link
          href={`/${salon.slug}`}
          className="text-accent underline underline-offset-4"
        >
          /{salon.slug}
        </Link>
      </p>

      <PhotoManager initial={salon.photos} />

      <SalonForm salon={salon} />
    </main>
  );
}
