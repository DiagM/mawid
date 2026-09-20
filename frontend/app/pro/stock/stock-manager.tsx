'use client';

import { useActionState } from 'react';
import type { StockProduct } from '@/lib/api-pro';
import { fr } from '@/lib/i18n/fr';
import { formatPrice } from '@/lib/format';
import {
  archiveProductAction,
  createProductAction,
  moveStockAction,
  type ActionState,
} from '../actions';

const initialState: ActionState = {};

const FIELD =
  'h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent';

export function StockManager({ products }: { products: StockProduct[] }) {
  const [createState, createAction, creating] = useActionState(
    createProductAction,
    initialState,
  );
  /**
   * Les mouvements partagent un seul état d'action : le refus « stock
   * négatif » est une réponse métier que le gérant doit lire, pas une erreur
   * à avaler en silence.
   */
  const [moveState, moveAction] = useActionState(moveStockAction, initialState);

  return (
    <>
      {moveState.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
        >
          {moveState.error}
        </p>
      )}

      {products.length === 0 ? (
        <p className="mb-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
          {fr.pro.stock.empty}
        </p>
      ) : (
        <ul className="mb-6 space-y-2">
          {products.map((product) => (
            <li
              key={product.id}
              className={`rounded-xl border bg-surface p-4 ${
                product.isLowStock ? 'border-danger' : 'border-border'
              } ${product.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {product.quantity}
                    {product.unit && ` ${product.unit}`}
                    {product.costCents !== null &&
                      ` · ${formatPrice(product.costCents)}`}
                    {!product.isActive && ` · ${fr.pro.stock.archived}`}
                  </p>
                  {product.isLowStock && (
                    <p className="mt-1 text-sm font-medium text-danger">
                      {fr.pro.stock.lowStock}
                    </p>
                  )}
                </div>

                {product.isActive && (
                  <form action={archiveProductAction} className="shrink-0">
                    <input type="hidden" name="id" value={product.id} />
                    <button
                      type="submit"
                      className="h-10 rounded-xl border border-border px-3 text-sm text-muted"
                    >
                      {fr.pro.stock.archive}
                    </button>
                  </form>
                )}
              </div>

              {product.isActive && (
                <form
                  action={moveAction}
                  className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
                >
                  <input type="hidden" name="productId" value={product.id} />

                  <label className="w-24">
                    <span className="mb-1 block text-xs text-muted">
                      {fr.pro.stock.movementAmount}
                    </span>
                    <input
                      type="number"
                      name="quantity"
                      required
                      min={1}
                      defaultValue={1}
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-border bg-background px-3"
                    />
                  </label>

                  <label className="min-w-32 flex-1">
                    <span className="mb-1 block text-xs text-muted">
                      {fr.pro.stock.reason}
                    </span>
                    <input
                      type="text"
                      name="reason"
                      maxLength={120}
                      placeholder={fr.pro.stock.reasonPlaceholder}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3"
                    />
                  </label>

                  <button
                    type="submit"
                    name="direction"
                    value="in"
                    className="h-10 rounded-lg border border-accent px-4 text-sm font-medium text-accent"
                  >
                    + {fr.pro.stock.movementIn}
                  </button>
                  <button
                    type="submit"
                    name="direction"
                    value="out"
                    className="h-10 rounded-lg border border-border px-4 text-sm font-medium"
                  >
                    − {fr.pro.stock.movementOut}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        action={createAction}
        className="rounded-xl border border-border bg-surface p-4"
      >
        <h2 className="mb-4 font-semibold">{fr.pro.stock.add}</h2>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">
            {fr.pro.stock.name}
          </span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={100}
            className={FIELD}
          />
        </label>

        <div className="mb-4 flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.stock.unit}
            </span>
            <input
              type="text"
              name="unit"
              maxLength={20}
              placeholder={fr.pro.stock.unitPlaceholder}
              className={FIELD}
            />
          </label>

          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.stock.cost}
            </span>
            <input
              type="number"
              name="costDinars"
              min={0}
              step={50}
              inputMode="numeric"
              className={FIELD}
            />
          </label>
        </div>

        <div className="mb-4 flex gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.stock.quantity}
            </span>
            <input
              type="number"
              name="quantity"
              min={0}
              defaultValue={0}
              inputMode="numeric"
              className={FIELD}
            />
          </label>

          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium">
              {fr.pro.stock.threshold}
            </span>
            <input
              type="number"
              name="lowStockThreshold"
              min={0}
              defaultValue={0}
              inputMode="numeric"
              className={FIELD}
            />
          </label>
        </div>

        {createState.error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger"
          >
            {createState.error}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {creating ? fr.pro.saving : fr.pro.save}
        </button>
      </form>
    </>
  );
}
