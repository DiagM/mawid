'use client';

import { useState } from 'react';
import { ApiError, joinWaitlist } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { formatLongDate, toE164 } from '@/lib/format';

/**
 * Inscription sur la liste d'attente d'une journée complète.
 *
 * Ne s'affiche que lorsqu'aucun créneau ne reste : sans cela, la liste
 * deviendrait un second canal de réservation, et le gérant passerait ses
 * journées à rappeler des clientes qui auraient pu réserver seules — le
 * backend refuse d'ailleurs l'inscription dans ce cas.
 *
 * Aucune notification automatique n'est promise. Le texte dit explicitement
 * que c'est le salon qui rappellera : promettre une alerte qui n'arriverait
 * jamais coûterait plus cher que de ne rien proposer.
 */
export function WaitlistForm({
  slug,
  date,
  prestationIds,
}: {
  slug: string;
  date: string;
  prestationIds: string[];
}) {
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  // Piège à robots : un humain ne voit jamais ce champ.
  const [website, setWebsite] = useState('');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (done) {
    return (
      <div className="mt-3 rounded-xl border border-accent bg-surface p-4">
        <p className="font-medium text-accent">{fr.waitlist.done}</p>
        <p className="mt-1 text-sm text-muted">
          {fr.waitlist.doneHelp.replace('{date}', formatLongDate(date))}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 h-12 w-full rounded-xl border border-accent font-medium text-accent"
      >
        {fr.waitlist.cta}
      </button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const e164 = toE164(phone);
    if (!e164) {
      setError(fr.booking.phoneInvalid);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await joinWaitlist(slug, {
        desiredDate: date,
        prestationIds,
        clientFirstName: firstName.trim(),
        clientPhone: e164,
        note: note.trim() || undefined,
        website: website || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : fr.common.networkError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-3 rounded-xl border border-accent bg-surface p-4"
    >
      <p className="font-medium">{fr.waitlist.title}</p>
      <p className="mt-1 text-sm text-muted">{fr.waitlist.help}</p>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.booking.firstName}
        </span>
        <input
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
          minLength={2}
          maxLength={50}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.booking.phone}
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          placeholder="0555 12 34 56"
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.waitlist.note}
        </span>
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder={fr.waitlist.notePlaceholder}
          className="h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent"
        />
      </label>

      {/* Honeypot : masqué en CSS, hors du parcours clavier. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 h-12 w-full rounded-xl bg-accent font-semibold text-white disabled:opacity-60"
      >
        {submitting ? fr.common.loading : fr.waitlist.submit}
      </button>
    </form>
  );
}
