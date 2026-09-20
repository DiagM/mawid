'use client';

import { useMemo, useState } from 'react';
import type { ClientRow } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPhone } from '@/lib/format';

/**
 * Composeur de campagne WhatsApp.
 *
 * Mawid n'envoie rien : l'API WhatsApp est payante (docs/MVP_SCOPE.md §2.1).
 * Ce que cet écran fait, c'est supprimer le travail répétitif — écrire le
 * message une fois, le personnaliser automatiquement, et ouvrir la
 * conversation du bon client en un clic. Le gérant reste l'expéditeur, ce qui
 * est aussi ce qui donne au message une chance d'être lu.
 *
 * Le suivi des envois vit en mémoire du composant : il sert à ne pas perdre
 * sa place dans une liste de trente noms pendant une session de dix minutes,
 * pas à constituer un historique. C'est dit explicitement à l'écran plutôt
 * que laissé découvrir après un rechargement.
 */
export function CampaignComposer({ clients }: { clients: ClientRow[] }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());

  const trimmed = message.trim();

  const links = useMemo(() => {
    if (trimmed.length === 0) {
      return [];
    }

    return clients.map((client) => {
      const personalized = trimmed.replaceAll('{prenom}', client.firstName);
      return {
        client,
        text: personalized,
        // `wa.me` attend le numéro sans « + » ni séparateur.
        href: `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(personalized)}`,
      };
    });
  }, [clients, trimmed]);

  function markSent(id: string) {
    setSent((current) => new Set(current).add(id));
  }

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
          placeholder={fr.pro.campaigns.messagePlaceholder}
          className="w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent"
        />
      </label>
      <p className="mb-6 text-sm text-muted">{fr.pro.campaigns.messageHelp}</p>

      {links.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.campaigns.noMessage}
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">
              {fr.pro.campaigns.progress
                .replace('{done}', String(sent.size))
                .replace('{total}', String(links.length))}
            </p>
            <p className="text-sm text-muted">
              {links.length}{' '}
              {links.length > 1
                ? fr.pro.campaigns.recipientsPlural
                : fr.pro.campaigns.recipients}
            </p>
          </div>

          <p className="mb-4 text-sm text-muted">
            {fr.pro.campaigns.notPersisted}
          </p>

          <ul className="space-y-2">
            {links.map(({ client, text, href }) => {
              const isSent = sent.has(client.id);

              return (
                <li
                  key={client.id}
                  className={`rounded-xl border border-border bg-surface p-4 ${
                    isSent ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{client.firstName}</p>
                      <p className="text-sm text-muted">
                        {formatPhone(client.phone)}
                      </p>
                    </div>

                    {isSent ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                        {fr.pro.campaigns.sent}
                      </span>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSent(client.id)}
                        className="flex h-10 shrink-0 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white"
                      >
                        {fr.pro.campaigns.send}
                      </a>
                    )}
                  </div>

                  {/*
                    L'aperçu du message personnalisé : c'est la seule façon de
                    vérifier que {prenom} a bien été remplacé avant d'ouvrir
                    trente conversations.
                  */}
                  <p className="mt-3 rounded-lg bg-background p-3 text-sm text-muted">
                    {text}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
