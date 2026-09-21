'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { fr } from '@/lib/i18n/fr';

type Status = 'idle' | 'locating' | 'denied' | 'unavailable' | 'unsupported';

/**
 * Tri des résultats par distance.
 *
 * La position vient de l'API de géolocalisation du navigateur : native,
 * gratuite, et surtout soumise à l'accord explicite de la cliente. Elle n'est
 * jamais envoyée ailleurs que dans l'URL de recherche, et jamais stockée.
 *
 * Le résultat passe par l'URL (`?lat=&lng=`) plutôt que par un état local :
 * la recherche reste partageable et rechargeable, et le tri se fait côté
 * serveur sur l'ensemble des salons — trier une page déjà reçue laisserait
 * un salon proche bloqué en page 2.
 */
export function NearbyButton() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('idle');

  const active = params.get('lat') !== null && params.get('lng') !== null;

  function withParams(next: Record<string, string | null>): string {
    const query = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(next)) {
      if (value === null) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }

    const suffix = query.toString();
    return suffix ? `/?${suffix}` : '/';
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('idle');
        router.push(
          withParams({
            // 5 décimales, soit environ un mètre. Au-delà on inscrirait dans
            // une URL partageable une précision que ni le GPS ni l'épingle du
            // gérant n'ont, pour rien.
            lat: position.coords.latitude.toFixed(5),
            lng: position.coords.longitude.toFixed(5),
          }),
        );
      },
      (error) => {
        setStatus(
          error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        );
      },
      // Position approchée : trier des salons à l'échelle d'une ville ne
      // demande pas le GPS fin, qui coûte de la batterie et plusieurs secondes.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  if (active) {
    return (
      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="font-medium text-accent">{fr.search.nearbyActive}</span>
        <button
          type="button"
          onClick={() => router.push(withParams({ lat: null, lng: null }))}
          className="text-muted underline underline-offset-4 hover:text-accent"
        >
          {fr.search.nearbyClear}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={locate}
        disabled={status === 'locating'}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:border-accent disabled:opacity-60"
      >
        <span aria-hidden>📍</span>
        {status === 'locating' ? fr.search.nearbyLocating : fr.search.nearby}
      </button>

      {status !== 'idle' && status !== 'locating' && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {status === 'denied'
            ? fr.search.nearbyDenied
            : status === 'unsupported'
              ? fr.search.nearbyUnsupported
              : fr.search.nearbyUnavailable}
        </p>
      )}
    </div>
  );
}
