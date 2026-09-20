'use client';

import { useState } from 'react';
import { fr } from '@/lib/i18n/fr';

/**
 * Bouton « copier », avec repli visible.
 *
 * `navigator.clipboard` n'existe pas partout : il exige un contexte sécurisé
 * (HTTPS ou localhost) et peut être refusé par le navigateur. Un bouton qui
 * échouerait en silence ferait coller au gérant le contenu de son
 * presse-papier précédent dans WhatsApp, sans qu'il comprenne pourquoi.
 * En cas d'échec, on affiche donc le texte, sélectionné, à copier à la main.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void copy()}
        className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
      >
        {state === 'copied' ? fr.pro.campaigns.copied : label}
      </button>

      {state === 'failed' && (
        <div className="mt-2">
          <p className="mb-1 text-sm text-muted">
            {fr.pro.campaigns.copyFailed}
          </p>
          <textarea
            readOnly
            value={value}
            rows={4}
            onFocus={(event) => event.target.select()}
            className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
