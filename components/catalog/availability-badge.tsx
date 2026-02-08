'use client';

import type { CatalogItem } from '@/lib/catalog-api';

type Availability = CatalogItem['availability'];

const styles: Record<Availability, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  out_of_stock: 'bg-amber-50 text-amber-800 border-amber-200',
  discontinued: 'bg-slate-100 text-slate-700 border-slate-200',
};

const labels: Record<Availability, string> = {
  available: 'Available',
  out_of_stock: 'Out of stock',
  discontinued: 'Discontinued',
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[value]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[value]}
    </span>
  );
}
