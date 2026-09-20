import type { Metadata } from 'next';
import { getProducts } from '@/lib/api-pro';
import { ApiError } from '@/lib/api';
import { PlanLocked } from '../plan-locked';
import { fr } from '@/lib/i18n/fr';
import { requireSessionToken } from '@/lib/session';
import { StockManager } from './stock-manager';

export const metadata: Metadata = { title: fr.pro.stock.title };

export default async function StockPage() {
  const token = await requireSessionToken();
  let products;
  try {
    products = await getProducts(token);
  } catch (error) {
    // Module hors offre : on présente ce qu'il apporte plutôt qu'une erreur.
    if (error instanceof ApiError && error.status === 403) {
      return <PlanLocked module="stock" />;
    }
    throw error;
  }

  const lowStock = products.filter((product) => product.isLowStock).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{fr.pro.stock.title}</h1>
      <p className="mb-6 text-sm text-muted">{fr.pro.stock.help}</p>

      {lowStock > 0 && (
        <p className="mb-6 rounded-xl bg-danger-soft p-4 font-medium text-danger">
          {lowStock} {fr.pro.stock.lowStock.toLowerCase()}
        </p>
      )}

      <StockManager products={products} />
    </main>
  );
}
