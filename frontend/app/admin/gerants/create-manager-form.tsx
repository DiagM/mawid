'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { createManagerAction, type AdminActionState } from '../actions';
import { GeneratedPassword } from '../salon-commercial-form';

const EMPTY: AdminActionState = {};

const CITIES = ['Alger', 'Oran', 'Constantine'];

export function CreateManagerForm() {
  const [state, action, pending] = useActionState(createManagerAction, EMPTY);

  // Une fois le salon créé, on remplace le formulaire par le mot de passe :
  // laisser le formulaire rempli inviterait à cliquer une seconde fois et à
  // créer un doublon, pendant que le seul affichage du secret disparaîtrait
  // du champ de vision.
  if (state.password) {
    return (
      <div>
        <p className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm">
          {state.success}
        </p>
        <GeneratedPassword phone={state.phone ?? ''} password={state.password} />
        {/* Vers la liste et non vers ce formulaire : on quitte l'écran qui
            affiche le mot de passe, et le salon tout juste créé apparaît
            dans la liste. Revenir ici inviterait surtout à recliquer et à
            créer un doublon. */}
        <Link
          href="/admin"
          className="mt-4 inline-block rounded-lg border border-border px-3 py-2 text-sm"
        >
          {fr.admin.salons.title}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field
        name="phone"
        label={fr.admin.managers.phone}
        type="tel"
        placeholder="0555 12 34 56"
        required
      />
      <Field name="fullName" label={fr.admin.managers.fullName} required />
      <Field name="salonName" label={fr.admin.managers.salonName} required />
      <Field
        name="addressLine"
        label={fr.admin.managers.addressLine}
        required
      />
      <Field name="district" label={fr.admin.managers.district} required />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{fr.admin.managers.city}</span>
        <select
          name="city"
          defaultValue="Alger"
          className="rounded-lg border border-border bg-surface px-3 py-2"
        >
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <Field
        name="contactPhone"
        label={fr.admin.managers.contactPhone}
        type="tel"
        placeholder="0661 12 34 56"
        required
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isWomenOnly" className="h-4 w-4" />
        {fr.admin.managers.isWomenOnly}
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? fr.common.loading : fr.admin.managers.submit}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-border bg-surface px-3 py-2"
      />
    </label>
  );
}
