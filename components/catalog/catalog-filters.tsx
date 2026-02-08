'use client';

import { useMemo, useState } from 'react';
import type { ListCatalogParams, CatalogItem } from '@/lib/catalog-api';
import TagInput from './tag-input';

interface CatalogFiltersProps {
  categories: string[];
  tagsPool: string[];
  initial: ListCatalogParams;
  onApply: (filters: ListCatalogParams) => void;
}

export function CatalogFilters({ categories, tagsPool, initial, onApply }: CatalogFiltersProps) {
  const [draft, setDraft] = useState<ListCatalogParams>(initial);

  const handleApply = () => {
    onApply({ ...draft, page: 1 });
  };

  type Availability = CatalogItem['availability'];
  type CatalogType = CatalogItem['type'];
  const availabilityOptions: Availability[] = ['available', 'out_of_stock', 'discontinued'];
  const typeOptions: CatalogType[] = ['product', 'service'];

  const tagsOptions = useMemo(() => Array.from(new Set([...tagsPool, ...(draft.tags || [])])), [tagsPool, draft.tags]);

  return (
    <div className="grid gap-3 rounded-2xl border border-border-color bg-card-bg p-4 md:grid-cols-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Search</label>
        <input
          value={draft.search ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          placeholder="Name or description"
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Category</label>
        <select
          value={draft.category ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value || undefined }))}
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Type</label>
        <select
          value={draft.type ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, type: (e.target.value as CatalogType) || undefined }))}
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t === 'product' ? 'Product' : 'Service'}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Availability</label>
        <select
          value={draft.availability ?? ''}
          onChange={(e) =>
            setDraft((d) => ({ ...d, availability: (e.target.value as Availability) || undefined }))
          }
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All</option>
          {availabilityOptions.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Price min</label>
        <input
          type="number"
          value={draft.price_min ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, price_min: e.target.value ? Number(e.target.value) : undefined }))}
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-text-secondary">Price max</label>
        <input
          type="number"
          value={draft.price_max ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, price_max: e.target.value ? Number(e.target.value) : undefined }))}
          className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="md:col-span-2">
        <TagInput
          value={draft.tags || []}
          onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
          placeholder="Add tags to filter"
          label="Tags"
          tooltip="Filter items containing all selected tags"
        />
        {tagsOptions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-text-secondary">
            {tagsOptions.slice(0, 6).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    tags: d.tags?.includes(t) ? d.tags.filter((tag) => tag !== t) : [...(d.tags || []), t],
                  }))
                }
                className={`rounded-full px-2 py-0.5 ${
                  draft.tags?.includes(t) ? 'bg-accent-soft text-accent' : 'bg-bg-secondary text-text-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="md:col-span-4 flex justify-end">
        <button
          type="button"
          onClick={handleApply}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}
