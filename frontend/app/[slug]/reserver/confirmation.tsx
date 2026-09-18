'use client';

import { useMemo, useState } from 'react';
import type { PublicSalon, ReservationView } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, formatPrice } from '@/lib/format';
import {
  buildIcs,
  icsFileName,
  manageUrl,
  salonPhoneLink,
  salonWhatsAppLink,
} from '@/lib/booking-share';

/**
 * Écran de confirmation.
 *
 * C'est ici que se joue toute la stratégie de notification gratuite : Mawid
 * n'envoie rien, donc cet écran doit donner au client les trois moyens de ne
 * pas perdre son rendez-vous — prévenir le salon, l'ajouter à son agenda,
 * garder son lien de gestion.
 */
export function Confirmation({
  reservation,
  salon,
  origin,
}: {
  reservation: ReservationView;
  salon: PublicSalon;
  /** Origine publique, calculée côté serveur (voir lib/request-origin.ts). */
  origin: string;
}) {
  const [copied, setCopied] = useState(false);

  const token = reservation.cancellationToken;
  const link = token && origin ? manageUrl(token, origin) : '';

  // La réponse de création ne contient pas le salon : on le complète depuis la
  // fiche déjà chargée, pour que les liens wa.me et le .ics soient exploitables.
  const enriched = useMemo<ReservationView>(
    () => ({
      ...reservation,
      salon: reservation.salon ?? {
        name: salon.name,
        slug: salon.slug,
        contactPhone: salon.contactPhone,
      },
    }),
    [reservation, salon],
  );

  /**
   * URL `data:` plutôt qu'un `URL.createObjectURL` : le calcul reste pur, donc
   * possible pendant le rendu, là où un blob imposerait un effet doublé d'un
   * `setState` (interdit par `react-hooks/set-state-in-effect`) et un cycle de
   * révocation à gérer. Un fichier .ics fait quelques centaines d'octets.
   */
  const icsUrl = useMemo(() => {
    if (!link) {
      return null;
    }
    const content = encodeURIComponent(buildIcs(enriched, link));
    return `data:text/calendar;charset=utf-8,${content}`;
  }, [enriched, link]);

  const whatsappLink = salonWhatsAppLink(enriched);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste affiché et sélectionnable à la main juste au-dessus.
      setCopied(false);
    }
  }

  return (
    <div className="pb-12">
      <div className="mb-6 rounded-2xl bg-accent-soft p-5 text-center">
        <h1 className="text-xl font-semibold text-accent">
          {fr.confirmation.title}
        </h1>
        <p className="mt-1 text-sm">{fr.confirmation.subtitle}</p>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-surface p-4">
        <p className="font-medium capitalize">
          {formatLongDate(reservation.localDate)} · {reservation.localTime}
        </p>
        <p className="mt-1 text-muted">
          {fr.confirmation.at} {salon.name}
        </p>

        <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          {reservation.prestations.map((line) => (
            <li key={line.name} className="flex justify-between gap-4">
              <span>{line.name}</span>
              <span className="text-muted">{formatPrice(line.priceCents)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
          <span>{fr.booking.total}</span>
          <span>{formatPrice(reservation.totalPriceCents)}</span>
        </p>
      </section>

      {whatsappLink && (
        <div className="mb-4">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {fr.confirmation.sendToSalon}
          </a>
          <p className="mt-2 text-sm text-muted">
            {fr.confirmation.sendToSalonHelp}
          </p>
        </div>
      )}

      {icsUrl && (
        <div className="mb-6">
          <a
            href={icsUrl}
            download={icsFileName(enriched)}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-surface font-medium"
          >
            {fr.confirmation.addToCalendar}
          </a>
          <p className="mt-2 text-sm text-muted">
            {fr.confirmation.addToCalendarHelp}
          </p>
        </div>
      )}

      {link && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-medium">
            {fr.confirmation.manageLink}
          </h2>
          <p className="mb-3 break-all rounded-lg bg-background p-3 text-sm text-muted">
            {link}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="h-11 w-full rounded-xl border border-border font-medium"
          >
            {copied ? fr.confirmation.copied : fr.confirmation.copyLink}
          </button>
          <p className="mt-2 text-sm text-muted">{fr.confirmation.keepLink}</p>
        </section>
      )}

      <a
        href={salonPhoneLink(salon.contactPhone)}
        className="block text-center text-sm text-muted underline underline-offset-4"
      >
        {fr.manage.callSalon}
      </a>
    </div>
  );
}
