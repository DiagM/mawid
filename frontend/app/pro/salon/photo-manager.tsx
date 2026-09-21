'use client';

import { useState } from 'react';
import { fr } from '@/lib/i18n/fr';
import {
  confirmPhotoAction,
  deletePhotoAction,
  photoUploadSignatureAction,
  reorderPhotosAction,
} from '../actions';

const MAX_PHOTOS = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Galerie du salon.
 *
 * Le fichier part **directement du navigateur vers l'hébergeur d'images** ;
 * le serveur Mawid ne fait que signer la demande, puis relire l'adresse
 * définitive. Deux raisons : l'image ne traverse pas un backend au budget
 * mémoire serré, et le secret d'API ne quitte jamais le serveur.
 *
 * Le contrôle de taille et de type est refait ici pour donner un message
 * immédiat — il ne protège rien, le serveur revérifie et supprime un fichier
 * refusé plutôt que de le laisser consommer le quota.
 */
export function PhotoManager({ initial }: { initial: string[] }) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError(fr.pro.photos.wrongType);
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(fr.pro.photos.tooLarge);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const signature = await photoUploadSignatureAction();

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('folder', signature.folder);
      form.append('signature', signature.signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: 'POST', body: form },
      );

      if (!response.ok) {
        throw new Error('upload failed');
      }

      const uploaded = (await response.json()) as { public_id: string };

      // Seul l'identifiant remonte : c'est le serveur qui relit l'adresse
      // définitive. Lui transmettre une URL permettrait d'en inventer une.
      const result = await confirmPhotoAction(uploaded.public_id);
      setPhotos(result.photos);
    } catch {
      setError(fr.pro.photos.failed);
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string) {
    setBusy(true);
    setError(null);

    try {
      setPhotos((await deletePhotoAction(url)).photos);
    } catch {
      setError(fr.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function makeFirst(url: string) {
    setBusy(true);
    setError(null);

    try {
      const reordered = [url, ...photos.filter((photo) => photo !== url)];
      setPhotos((await reorderPhotosAction(reordered)).photos);
    } catch {
      setError(fr.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">{fr.pro.photos.title}</h2>
      <p className="mt-1 text-sm text-muted">{fr.pro.photos.help}</p>

      {photos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border p-4 text-center text-sm text-muted">
          {fr.pro.photos.empty}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((url, index) => (
            <li
              key={url}
              className="overflow-hidden rounded-xl border border-border"
            >
              {/* `img` et non `next/image` : ces URL viennent d'un hébergeur
                  externe et l'optimiseur de Next les ferait toutes transiter
                  par le serveur, qu'on cherche précisément à décharger. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="aspect-square w-full object-cover"
              />

              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                {index === 0 ? (
                  <span className="font-medium text-accent">
                    {fr.pro.photos.cover}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void makeFirst(url)}
                    className="text-muted underline underline-offset-4 disabled:opacity-50"
                  >
                    {fr.pro.photos.makeFirst}
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(url)}
                  className="text-danger underline underline-offset-4 disabled:opacity-50"
                >
                  {fr.pro.photos.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {photos.length >= MAX_PHOTOS ? (
        <p className="mt-4 text-sm text-muted">{fr.pro.photos.full}</p>
      ) : (
        <label className="mt-4 flex h-12 cursor-pointer items-center justify-center rounded-xl border border-accent font-medium text-accent">
          {busy ? fr.pro.photos.uploading : fr.pro.photos.add}
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Réinitialisé pour que choisir deux fois le même fichier
              // déclenche bien un second envoi.
              event.target.value = '';
              if (file) {
                void upload(file);
              }
            }}
            className="sr-only"
          />
        </label>
      )}
    </section>
  );
}
