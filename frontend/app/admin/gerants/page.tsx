import type { Metadata } from 'next';
import { fr } from '@/lib/i18n/fr';
import { requireAdminToken } from '@/lib/session';
import { CreateManagerForm } from './create-manager-form';

export const metadata: Metadata = { title: fr.admin.managers.title };

export default async function CreateManagerPage() {
  // Rien à charger : cette page ne fait qu'écrire. Le contrôle reste
  // indispensable — une page d'administration rendue à un gérant lui
  // apprendrait au minimum que la console existe.
  await requireAdminToken();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.admin.managers.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.admin.managers.help}</p>

      <CreateManagerForm />
    </main>
  );
}
