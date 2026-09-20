'use client';

import { useMemo } from 'react';
import type { ClientRow } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { CopyButton } from './copy-button';

/**
 * Plafond d'une liste de diffusion WhatsApp. Au-delà, l'application refuse
 * d'ajouter des destinataires : mieux vaut découper nous-mêmes en lots
 * numérotés que laisser le gérant découvrir la limite à la 257e cliente.
 */
const BROADCAST_MAX = 256;

/**
 * ============================================
 * Assistant « liste de diffusion »
 * ============================================
 * Le seul envoi en masse réellement gratuit. WhatsApp facture les messages
 * marketing de son API officielle, et les bibliothèques non officielles font
 * bannir le numéro du salon (docs/MVP_SCOPE.md §2.1). La liste de diffusion
 * native, elle, part du téléphone du gérant, en un seul envoi, sans rien
 * coûter à personne.
 *
 * Deux limites que cet écran énonce plutôt que de les laisser découvrir :
 *
 * 1. **Aucune personnalisation.** Un message de diffusion est identique pour
 *    tout le monde — pas de `{prenom}`. Pour un message personnalisé, c'est
 *    l'envoi un par un.
 * 2. **Les destinataires doivent avoir enregistré le numéro du salon.**
 *    C'est une règle de WhatsApp, pas un réglage : sans cela le message
 *    n'arrive pas, et l'expéditeur ne le sait jamais.
 */
export function BroadcastList({
  clients,
  message,
}: {
  clients: ClientRow[];
  message: string;
}) {
  const batches = useMemo(() => {
    const result: ClientRow[][] = [];
    for (let index = 0; index < clients.length; index += BROADCAST_MAX) {
      result.push(clients.slice(index, index + BROADCAST_MAX));
    }
    return result;
  }, [clients]);

  const trimmed = message.trim();
  // Un `{prenom}` laissé dans un message de diffusion partirait tel quel :
  // « Bonjour {prenom} » chez trois cents personnes.
  const hasPlaceholder = trimmed.includes('{prenom}');

  return (
    <section>
      <ol className="mb-6 space-y-1 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        {fr.pro.campaigns.broadcastSteps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="shrink-0 font-medium text-fg">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm">
        ⚠️ {fr.pro.campaigns.broadcastCaveat}
      </p>

      {hasPlaceholder && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {fr.pro.campaigns.broadcastPlaceholder}
        </p>
      )}

      {trimmed.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium">
            {fr.pro.campaigns.broadcastMessage}
          </p>
          <p className="mb-2 rounded-xl border border-border bg-background p-3 text-sm">
            {trimmed}
          </p>
          <CopyButton
            value={trimmed}
            label={fr.pro.campaigns.copyMessage}
          />
        </div>
      )}

      {batches.map((batch, index) => (
        <div key={index} className="mb-4 rounded-xl border border-border bg-surface p-4">
          <p className="mb-1 font-medium">
            {batches.length > 1
              ? fr.pro.campaigns.batchTitle
                  .replace('{index}', String(index + 1))
                  .replace('{total}', String(batches.length))
              : fr.pro.campaigns.numbers}
          </p>
          <p className="mb-3 text-sm text-muted">
            {batch.length}{' '}
            {batch.length > 1
              ? fr.pro.campaigns.recipientsPlural
              : fr.pro.campaigns.recipients}
          </p>

          <CopyButton
            value={batch.map((client) => client.phone).join('\n')}
            label={fr.pro.campaigns.copyNumbers}
          />
        </div>
      ))}
    </section>
  );
}
