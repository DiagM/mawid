import type { Metadata } from 'next';
import { getMyEmployees } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { TeamManager } from './team-manager';

export const metadata: Metadata = { title: fr.pro.team.title };

export default async function TeamPage() {
  const token = await requireSessionToken();
  const employees = await getMyEmployees(token);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.team.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.pro.team.help}</p>

      <TeamManager employees={employees} />
    </main>
  );
}
