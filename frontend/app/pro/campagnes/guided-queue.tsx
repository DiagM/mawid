'use client';

import { useMemo, useState } from 'react';
import type { ClientRow } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPhone } from '@/lib/format';

/**
 * ============================================
 * Envoi un par un, guidé
 * ============================================
 * L'inverse de la liste de diffusion, et son complément :
 * - il atteint **tout le monde**, y compris les clientes qui n'ont pas
 *   enregistré le numéro du salon ;
 * - le message porte le prénom.
 *
 * Le prix à payer est un clic par personne. Ce que cet écran supprime, c'est
 * tout le reste : plus de va-et-vient dans une liste de trente noms, plus
 * de recherche de l'endroit où l'on s'était arrêté. Une seule cliente à
 * l'écran, un bouton, la suivante.
 *
 * La progression vit en mémoire du composant : elle sert à tenir une session
 * de dix minutes, pas à constituer un historique. C'est dit à l'écran plutôt
 * que découvert après un rechargement.
 */
export function GuidedQueue({
  clients,
  message,
}: {
  clients: ClientRow[];
  message: string;
}) {
  const [index, setIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);

  const trimmed = message.trim();

  const personalized = useMemo(() => {
    const client = clients[index];
    if (!client || trimmed.length === 0) {
      return null;
    }

    const text = trimmed.replaceAll('{prenom}', client.firstName);

    return {
      client,
      text,
      // `wa.me` attend le numéro sans « + » ni séparateur.
      href: `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
    };
  }, [clients, index, trimmed]);

  if (trimmed.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
        {fr.pro.campaigns.noMessage}
      </p>
    );
  }

  if (index >= clients.length) {
    return (
      <div className="rounded-xl border border-accent bg-surface p-6 text-center">
        <p className="font-medium">{fr.pro.campaigns.queueDone}</p>
        <p className="mt-1 text-sm text-muted">
          {fr.pro.campaigns.progress
            .replace('{done}', String(sentCount))
            .replace('{total}', String(clients.length))}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setSentCount(0);
          }}
          className="mt-4 h-10 rounded-xl border border-border px-4 text-sm font-medium"
        >
          {fr.pro.campaigns.queueRestart}
        </button>
      </div>
    );
  }

  if (!personalized) {
    return null;
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">
          {fr.pro.campaigns.progress
            .replace('{done}', String(sentCount))
            .replace('{total}', String(clients.length))}
        </p>
        <p className="text-sm text-muted">
          {index + 1} / {clients.length}
        </p>
      </div>

      {/* Barre de progression : sur trente noms, savoir qu'il en reste cinq
          change la décision de continuer maintenant ou plus tard. */}
      <div
        className="mb-6 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={clients.length}
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${(index / clients.length) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-lg font-semibold">
          {personalized.client.firstName}
        </p>
        <p className="text-sm text-muted">
          {formatPhone(personalized.client.phone)}
        </p>

        <p className="mt-4 rounded-lg bg-background p-3 text-sm">
          {personalized.text}
        </p>

        <a
          href={personalized.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            setSentCount((count) => count + 1);
            setIndex((current) => current + 1);
          }}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white"
        >
          {fr.pro.campaigns.sendAndNext}
        </a>

        <button
          type="button"
          onClick={() => setIndex((current) => current + 1)}
          className="mt-2 h-10 w-full rounded-xl border border-border text-sm font-medium"
        >
          {fr.pro.campaigns.skip}
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {fr.pro.campaigns.notPersisted}
      </p>
    </section>
  );
}
