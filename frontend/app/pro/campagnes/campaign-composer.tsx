'use client';

import { useState } from 'react';
import type { ClientRow } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { BroadcastList } from './broadcast-list';
import { GuidedQueue } from './guided-queue';

type Mode = 'broadcast' | 'queue';

/**
 * Composeur de campagne WhatsApp.
 *
 * Mawid n'envoie rien : l'API officielle facture les messages marketing, et
 * automatiser WhatsApp par une bibliothèque non officielle ferait bannir le
 * numéro du salon (docs/MVP_SCOPE.md §2.1).
 *
 * Restent deux façons d'envoyer en masse sans rien payer, et ce ne sont pas
 * deux variantes de la même idée — ce sont deux stratégies opposées :
 *
 * | | Atteint | Message |
 * |---|---|---|
 * | Diffusion | Seulement ceux qui ont enregistré le numéro du salon | Identique pour tous |
 * | Un par un | Tout le monde | Personnalisé |
 *
 * D'où deux modes explicites plutôt qu'un écran qui essaierait de faire les
 * deux à moitié. La diffusion est proposée en premier : c'est celle qui, en
 * un seul envoi, touche le plus de monde.
 */
export function CampaignComposer({ clients }: { clients: ClientRow[] }) {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<Mode>('broadcast');

  const modes: { value: Mode; label: string; help: string }[] = [
    {
      value: 'broadcast',
      label: fr.pro.campaigns.modeBroadcast,
      help: fr.pro.campaigns.modeBroadcastHelp,
    },
    {
      value: 'queue',
      label: fr.pro.campaigns.modeQueue,
      help: fr.pro.campaigns.modeQueueHelp,
    },
  ];

  const active = modes.find((entry) => entry.value === mode)!;

  return (
    <>
      <label className="mb-1 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.campaigns.message}
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={800}
          placeholder={
            mode === 'queue'
              ? fr.pro.campaigns.messagePlaceholder
              : fr.pro.campaigns.broadcastPlaceholderText
          }
          className="w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent"
        />
      </label>
      <p className="mb-6 text-sm text-muted">
        {mode === 'queue'
          ? fr.pro.campaigns.messageHelp
          : fr.pro.campaigns.broadcastNoPlaceholder}
      </p>

      <div
        role="tablist"
        aria-label={fr.pro.campaigns.mode}
        className="mb-2 flex flex-wrap gap-2"
      >
        {modes.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={entry.value === mode}
            onClick={() => setMode(entry.value)}
            className={`flex h-10 items-center rounded-xl border px-4 text-sm font-medium transition-colors ${
              entry.value === mode
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm text-muted">{active.help}</p>

      {mode === 'broadcast' ? (
        <BroadcastList clients={clients} message={message} />
      ) : (
        <GuidedQueue clients={clients} message={message} />
      )}
    </>
  );
}
