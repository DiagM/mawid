'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError, createTicket, type CreateTicketInput } from '@/lib/api';
import { fr } from '@/lib/i18n/fr';
import { toE164 } from '@/lib/format';

type Kind = CreateTicketInput['kind'];

/**
 * Formulaire de contact.
 *
 * Utilisé aussi bien par un visiteur que par un gérant connecté : dans le
 * second cas `submit` est fourni par la page, qui passe par une Server
 * Action pour rattacher le salon — le jeton vit dans un cookie `httpOnly`
 * que ce composant ne peut pas lire.
 */
export function ContactForm({
  defaultKind = 'OTHER',
  defaultPlan,
  defaultName = '',
  defaultPhone = '',
  submit,
}: {
  defaultKind?: Kind;
  defaultPlan?: 'PRO' | 'PRO_PLUS';
  defaultName?: string;
  defaultPhone?: string;
  /** Envoi authentifié. Absent : envoi public. */
  submit?: (input: CreateTicketInput) => Promise<unknown>;
}) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [plan, setPlan] = useState<'PRO' | 'PRO_PLUS'>(defaultPlan ?? 'PRO');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kinds: { value: Kind; label: string }[] = [
    { value: 'UPGRADE', label: fr.contact.kindUpgrade },
    { value: 'ISSUE', label: fr.contact.kindIssue },
    { value: 'OTHER', label: fr.contact.kindOther },
  ];

  if (done) {
    return (
      <div className="rounded-xl border border-accent bg-surface p-6 text-center">
        <p className="font-display text-lg">{fr.contact.done}</p>
        <p className="mt-2 text-sm text-muted">{fr.contact.doneHelp}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setSubject('');
              setMessage('');
            }}
            className="h-11 rounded-xl border border-border px-4 text-sm font-medium"
          >
            {fr.contact.another}
          </button>
          <Link
            href="/"
            className="flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            {fr.contact.backHome}
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const e164 = toE164(phone);
    if (!e164) {
      setError(fr.contact.invalidPhone);
      return;
    }

    if (message.trim().length < 10) {
      setError(fr.contact.tooShort);
      return;
    }

    const input: CreateTicketInput = {
      kind,
      subject: subject.trim(),
      message: message.trim(),
      contactName: name.trim(),
      contactPhone: e164,
      ...(email.trim() && { contactEmail: email.trim() }),
      ...(kind === 'UPGRADE' && { requestedPlan: plan }),
      ...(website && { website }),
    };

    setSending(true);
    setError(null);

    try {
      await (submit ? submit(input) : createTicket(input));
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : fr.common.networkError,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{fr.contact.kind}</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setKind(entry.value)}
              aria-pressed={kind === entry.value}
              className={`h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
                kind === entry.value
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'UPGRADE' && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {fr.contact.plan}
          </span>
          <select
            value={plan}
            onChange={(event) =>
              setPlan(event.target.value as 'PRO' | 'PRO_PLUS')
            }
            className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
          >
            <option value="PRO">Pro — 3 000 DZD / mois</option>
            <option value="PRO_PLUS">Pro+ — 5 500 DZD / mois</option>
          </select>
        </label>
      )}

      <Field
        label={fr.contact.subject}
        value={subject}
        onChange={setSubject}
        placeholder={fr.contact.subjectPlaceholder}
        required
        minLength={3}
        maxLength={120}
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {fr.contact.message}
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={5}
          maxLength={2000}
          placeholder={fr.contact.messagePlaceholder}
          className="w-full rounded-xl border border-border bg-surface p-4 outline-none focus:border-accent"
        />
      </label>

      <Field
        label={fr.contact.name}
        value={name}
        onChange={setName}
        required
        minLength={2}
        maxLength={80}
      />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {fr.contact.phone}
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          placeholder="0555 12 34 56"
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        />
        <span className="mt-1 block text-xs text-muted">
          {fr.contact.phoneHelp}
        </span>
      </label>

      <Field
        label={fr.contact.email}
        value={email}
        onChange={setEmail}
        type="email"
        maxLength={160}
      />

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
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="h-12 w-full rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {sending ? fr.contact.sending : fr.contact.submit}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
        {...rest}
      />
    </label>
  );
}
