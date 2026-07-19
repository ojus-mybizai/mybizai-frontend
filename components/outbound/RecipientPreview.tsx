'use client';

/**
 * RecipientPreview — interactive, paginated list of the contacts an audience
 * filter resolves to (Campaign Audience Tier 2 · T2.2).
 *
 * Lazy: the paginated endpoint is only hit once the panel is expanded, so the
 * cheap count preview stays cheap. Removing a row pushes the contact id into
 * `filter.exclude_contact_ids` — the backend applies that exclusion in BOTH
 * the preview resolver and the launch materializer, so a trim genuinely holds
 * through preview → review → send.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Users, X, Loader2 } from 'lucide-react';
import type { AudienceFilter } from '@/services/outbound';
import { previewAudienceContacts, type RecipientPreviewContact } from '@/services/outbound';

const PER_PAGE = 25;

export function RecipientPreview({
  filter,
  onChange,
}: {
  filter: AudienceFilter;
  onChange: (next: AudienceFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RecipientPreviewContact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Re-fetch key: any change to the filter (including exclusions) invalidates.
  const filterKey = JSON.stringify(filter);

  const fetchPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const res = await previewAudienceContacts(
          { audience_type: 'ai_filter', filter },
          { page: p, per_page: PER_PAGE },
        );
        setRows(res.contacts);
        setTotal(res.total);
        setPage(res.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load recipients');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  // Fetch page 1 whenever the panel is open and the filter changes.
  useEffect(() => {
    if (!open) return;
    void fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filterKey]);

  const excludedCount = filter.exclude_contact_ids?.length ?? 0;

  const remove = (id: number | null) => {
    if (id == null) return;
    const next = new Set(filter.exclude_contact_ids ?? []);
    next.add(id);
    onChange({ ...filter, exclude_contact_ids: Array.from(next) });
    // Optimistic: drop the row immediately; the filterKey change refetches.
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="border border-border-color rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 bg-bg-secondary hover:bg-bg-secondary/80 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-text-primary uppercase tracking-wide">
          <Users className="h-3.5 w-3.5" />
          Preview recipients
          {open && !loading && (
            <span className="normal-case font-normal text-text-secondary">
              · {total.toLocaleString()}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {excludedCount > 0 && (
            <span className="normal-case text-[11px] text-amber-500">{excludedCount} removed</span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-text-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 py-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading recipients…
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-red-500 py-2">{error}</p>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="text-xs text-text-secondary italic py-4 text-center">
              No matching contacts.
            </p>
          )}

          {!loading && !error && rows.length > 0 && (
            <ul className="divide-y divide-border-color/50">
              {rows.map((c) => (
                <li key={c.id ?? c.phone} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-primary truncate">
                        {c.name || c.phone || 'Unknown'}
                      </span>
                      {c.stage && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                          {c.stage}
                        </span>
                      )}
                      {c.owner && (
                        <span className="text-[10px] text-text-secondary">· {c.owner}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5">
                      {c.phone && <span>{c.phone}</span>}
                      {c.source && <span>· {c.source}</span>}
                      {(c.tags ?? []).slice(0, 3).map((t) => (
                        <span key={t} className="px-1 py-0.5 rounded bg-bg-secondary">#{t}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    title="Remove from audience"
                    className="shrink-0 text-text-secondary hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {!loading && !error && total > PER_PAGE && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}
                className="px-2.5 py-1 text-xs border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-[11px] text-text-secondary">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => fetchPage(page + 1)}
                className="px-2.5 py-1 text-xs border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
