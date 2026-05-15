'use client';

/**
 * SegmentSelector — pick a saved segment as campaign audience.
 *
 * Shows each segment as a selectable card with its filter summary,
 * contact count, and creation date. Single-select (radio-style).
 *
 * Used in the campaign wizard Step 2 when audience_type = "segment".
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, CheckCircle2 } from 'lucide-react';
import { listSegments, type Segment, type AudienceFilter } from '@/services/outbound';

interface Props {
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

/* ── Filter summary — compact read-only label list ─────────────────────── */
function FilterSummary({ f }: { f: AudienceFilter }) {
  const parts: string[] = [];
  const n = (arr?: unknown[]) => arr?.length ?? 0;

  if (n(f.group_ids))        parts.push(`${n(f.group_ids)} group(s)`);
  if (n(f.tag_ids))          parts.push(`${n(f.tag_ids)} tag(s)`);
  if (n(f.source_channels))  parts.push((f.source_channels!).join(', '));
  if (n(f.priority))         parts.push((f.priority!).join(' / ') + ' priority');
  if (f.last_messaged_within_days) parts.push(`active ≤${f.last_messaged_within_days}d`);
  if (f.not_messaged_within_days)  parts.push(`silent ≥${f.not_messaged_within_days}d`);
  if (f.created_after)   parts.push(`after ${f.created_after}`);
  if (f.created_before)  parts.push(`before ${f.created_before}`);
  // legacy tag names
  if (n(f.tags) && !n(f.tag_ids)) parts.push((f.tags!).join(', '));

  if (parts.length === 0)
    return <span className="text-xs text-text-secondary italic">No filters — matches all contacts</span>;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {parts.map((p, i) => (
        <span
          key={i}
          className="rounded-full bg-bg-secondary border border-border-color px-2 py-0.5 text-[11px] text-text-secondary"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function SegmentSelector({ selectedId, onChange }: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setSegments(await listSegments());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load segments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-text-secondary animate-pulse">
        Loading segments…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-color py-10 text-center px-4">
        <div className="text-3xl mb-2">🎯</div>
        <p className="text-sm font-medium text-text-primary">No segments yet</p>
        <p className="text-xs text-text-secondary mt-1 mb-4 max-w-xs mx-auto">
          Create a saved audience filter and reuse it across campaigns without
          rebuilding filters each time.
        </p>
        <Link
          href="/outbound/segments"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Create a segment
        </Link>
        <p className="text-[11px] text-text-secondary mt-3">
          Opens in a new tab — come back here and refresh to pick it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {segments.length} segment{segments.length !== 1 ? 's' : ''} saved
        </p>
        <Link
          href="/outbound/segments"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Manage segments
        </Link>
      </div>

      {/* Segment cards */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        {segments.map((seg) => {
          const isSelected = selectedId === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => onChange(isSelected ? null : seg.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all
                ${isSelected
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                  : 'border-border-color bg-bg-primary hover:border-accent/40 hover:bg-bg-secondary/50'
                }`}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-border-color" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                      {seg.name}
                    </span>
                    {seg.created_by_ai && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                        AI generated
                      </span>
                    )}
                    {seg.cached_count !== null && (
                      <span className="flex items-center gap-1 text-[11px] text-text-secondary ml-auto">
                        <Users className="h-3 w-3" />
                        {seg.cached_count.toLocaleString()} contacts
                      </span>
                    )}
                  </div>

                  {seg.description && (
                    <p className="text-xs text-text-secondary mt-0.5 truncate">
                      {seg.description}
                    </p>
                  )}

                  <FilterSummary f={(seg.filter_config as AudienceFilter) ?? {}} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected summary */}
      {selectedId && (
        <p className="text-xs text-accent font-medium pt-1">
          ✓ Segment selected — click "Preview Audience" to confirm the count before continuing.
        </p>
      )}
    </div>
  );
}
