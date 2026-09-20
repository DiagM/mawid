'use client';

import { useActionState } from 'react';
import { fr } from '@/lib/i18n/fr';
import { createCashMovementAction, type ActionState } from '../actions';

const initialState: ActionState = {};

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent';

/**
 * Saisie libre d'une recette ou d'une dépense.
 *
 * Deux formulaires distincts plutôt qu'un sélecteur de type : le geste
 * « j'encaisse » et le geste « j'ai acheté » n'ont rien à voir, et les
 * confondre dans un même écran fait cocher le mauvais bouton un jour sur dix.
 */
export function CashForm({ type }: { type: 'SALE' | 'EXPENSE' }) {
  const [state, action, pending] = useActionState(
    createCashMovementAction,
    initialState,
  );

  const isSale = type === 'SALE';

  return (
    <form
      action={action}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="mb-4 font-semibold">
        {isSale ? fr.pro.cash.addSale : fr.pro.cash.addExpense}
      </h2>

      <input type="hidden" name="type" value={type} />

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">
          {fr.pro.cash.label}
        </span>
        <input
          type="text"
          name="label"
          required
          minLength={2}
          maxLength={120}
          placeholder={
            isSale
              ? fr.pro.cash.labelSalePlaceholder
              : fr.pro.cash.labelExpensePlaceholder
          }
          className={FIELD}
        />
      </label>

      <div className="mb-4 flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.cash.amount}
          </span>
          <input
            type="number"
            name="amountDinars"
            required
            min={1}
            step={50}
            inputMode="numeric"
            className={FIELD}
          />
        </label>

        {isSale && (
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.cash.method}
            </span>
            <select name="method" defaultValue="CASH" className={FIELD}>
              <option value="CASH">{fr.pro.cash.methodCASH}</option>
              <option value="CARD">{fr.pro.cash.methodCARD}</option>
              <option value="TRANSFER">{fr.pro.cash.methodTRANSFER}</option>
            </select>
          </label>
        )}
      </div>

      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`flex h-12 w-full items-center justify-center rounded-xl font-semibold transition-colors disabled:opacity-60 ${
          isSale
            ? 'bg-accent text-white hover:bg-accent-hover'
            : 'border border-border'
        }`}
      >
        {pending ? fr.pro.saving : fr.pro.save}
      </button>
    </form>
  );
}
