import type { Metadata } from 'next';
import Link from 'next/link';
import { getClients, type ClientSegment } from '@/lib/api-pro';
import { ApiError } from '@/lib/api';
import { PlanLocked } from '../plan-locked';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { CampaignComposer } from './campaign-composer';

export const metadata: Metadata = { title: fr.pro.campaigns.title };

type PageProps = { searchParams: Promise<{ segment?: string }> };

const SEGMENTS: {
  value: ClientSegment;
  label: string;
  help?: string;
}[] = [
  { value: 'lapsed', label: fr.pro.campaigns.segmentLapsed, help: fr.pro.campaigns.segmentLapsedHelp },
  { value: 'regulars', label: fr.pro.campaigns.segmentRegulars, help: fr.pro.campaigns.segmentRegularsHelp },
  { value: 'all', label: fr.pro.campaigns.segmentAll },
];

export default async function CampaignsPage({ searchParams }: PageProps) {
  const token = await requireSessionToken();
  const params = await searchParams;

  // `lapsed` par défaut : c'est la relance qui rapporte le plus, autant
  // ouvrir sur elle plutôt que sur « tous mes clients ».
  const segment: ClientSegment = SEGMENTS.some(
    (entry) => entry.value === params.segment,
  )
    ? (params.segment as ClientSegment)
    : 'lapsed';

  let clients;
  try {
    clients = await getClients(token, { segment });
  } catch (error) {
    // Module hors offre : on présente ce qu'il apporte plutôt qu'une erreur.
    if (error instanceof ApiError && error.status === 403) {
      return <PlanLocked module="clients" />;
    }
    throw error;
  }
  const active = SEGMENTS.find((entry) => entry.value === segment);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.campaigns.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.pro.campaigns.help}</p>

      <nav aria-label={fr.pro.campaigns.segment} className="mb-2 flex flex-wrap gap-2">
        {SEGMENTS.map((entry) => (
          <Link
            key={entry.value}
            href={`/pro/campagnes?segment=${entry.value}`}
            aria-current={entry.value === segment ? 'page' : undefined}
            className={`flex h-10 items-center rounded-xl border px-4 text-sm font-medium transition-colors ${
              entry.value === segment
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {active?.help && (
        <p className="mb-6 text-sm text-muted">{active.help}</p>
      )}

      {clients.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-muted">{fr.pro.campaigns.empty}</p>
          <p className="mt-1 text-sm text-muted">
            {fr.pro.campaigns.emptyHelp}
          </p>
        </div>
      ) : (
        <CampaignComposer clients={clients.items} />
      )}
    </main>
  );
}
