'use client';

/**
 * FilterBuilder — visual no-code filter builder for segment / campaign audiences.
 *
 * Fetches live filter options from GET /segments/filter-options and renders
 * collapsible sections for each filter dimension. Emits the full AudienceFilter
 * object on every change via `onChange`.
 *
 * Replaces the broken /leads/pipeline-stages implementation.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { AudienceFilter, FilterOptions, FilterPickItem } from '@/services/outbound';
import { getFilterOptions } from '@/services/outbound';

interface Props {
  value: AudienceFilter;
  onChange: (next: AudienceFilter) => void;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function toggleId(arr: number[] | undefined, id: number): number[] {
  const s = new Set(arr ?? []);
  s.has(id) ? s.delete(id) : s.add(id);
  return Array.from(s);
}

function toggleStr(arr: string[] | undefined, val: string): string[] {
  const s = new Set(arr ?? []);
  s.has(val) ? s.delete(val) : s.add(val);
  return Array.from(s);
}

function ColorDot({ color }: { color?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: color || '#6366f1' }}
    />
  );
}

/* ── Pill multi-select (for types, sources, priority) ─────────────────── */
function PillGroup({
  options,
  selected,
  onToggle,
  colorMap,
}: {
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-all
              ${active
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border-color text-text-secondary hover:border-accent/50 hover:text-text-primary'
              }`}
          >
            {(o.color || colorMap?.[o.value]) && (
              <ColorDot color={o.color || colorMap?.[o.value]} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Checkbox list (for tags and groups — can be long) ─────────────────── */
function CheckboxList({
  items,
  selectedIds,
  onToggle,
}: {
  items: FilterPickItem[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-text-secondary italic">None created yet.</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-all
              ${checked
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border-color text-text-secondary hover:border-accent/50 hover:text-text-primary'
              }`}
          >
            <ColorDot color={item.color} />
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible section ─────────────────────────────────────────────── */
function Section({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border-color rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 bg-bg-secondary hover:bg-bg-secondary/80 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {!!badge && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-text-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && <div className="px-3 py-3">{children}</div>}
    </div>
  );
}

/* ── Active filter summary chips ─────────────────────────────────────── */
function ActiveSummary({
  value,
  options,
  onClear,
}: {
  value: AudienceFilter;
  options: FilterOptions | null;
  onClear: (patch: Partial<AudienceFilter>) => void;
}) {
  const chips: { label: string; clear: () => void }[] = [];

  (value.group_ids ?? []).forEach((id) => {
    const g = options?.groups.find((x) => x.id === id);
    if (g) chips.push({ label: `Group: ${g.name}`, clear: () => onClear({ group_ids: (value.group_ids ?? []).filter((x) => x !== id) }) });
  });
  (value.tag_ids ?? []).forEach((id) => {
    const t = options?.tags.find((x) => x.id === id);
    if (t) chips.push({ label: `#${t.name}`, clear: () => onClear({ tag_ids: (value.tag_ids ?? []).filter((x) => x !== id) }) });
  });
  (value.source_channels ?? []).forEach((s) => {
    const src = options?.sources.find((x) => x.value === s);
    chips.push({ label: `via ${src?.label ?? s}`, clear: () => onClear({ source_channels: (value.source_channels ?? []).filter((x) => x !== s) }) });
  });
  (value.priority ?? []).forEach((p) => {
    chips.push({ label: `${p} priority`, clear: () => onClear({ priority: (value.priority ?? []).filter((x) => x !== p) }) });
  });
  if (value.last_messaged_within_days)
    chips.push({ label: `Active ≤ ${value.last_messaged_within_days}d`, clear: () => onClear({ last_messaged_within_days: undefined }) });
  if (value.not_messaged_within_days)
    chips.push({ label: `Silent ≥ ${value.not_messaged_within_days}d`, clear: () => onClear({ not_messaged_within_days: undefined }) });
  if (value.created_after)
    chips.push({ label: `Joined after ${value.created_after}`, clear: () => onClear({ created_after: undefined }) });
  if (value.created_before)
    chips.push({ label: `Joined before ${value.created_before}`, clear: () => onClear({ created_before: undefined }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 p-3 bg-accent/5 border border-accent/20 rounded-lg">
      <span className="text-[11px] font-medium text-text-secondary self-center mr-1">Active:</span>
      {chips.map((c, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-accent/10 border border-accent/30 px-2 py-0.5 text-[11px] text-accent"
        >
          {c.label}
          <button type="button" onClick={c.clear} className="hover:text-red-500 transition-colors">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onClear({
          group_ids: [], tag_ids: [],
          source_channels: [], priority: [],
          last_messaged_within_days: undefined,
          not_messaged_within_days: undefined,
          created_after: undefined,
          created_before: undefined,
        })}
        className="text-[11px] text-text-secondary hover:text-red-500 transition-colors ml-auto"
      >
        Clear all
      </button>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'High',   color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low',    label: 'Low',    color: '#6b7280' },
];

export function FilterBuilder({ value, onChange }: Props) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getFilterOptions();
        setOptions(data);
      } catch {
        // silent — sections render gracefully with empty lists
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<AudienceFilter>) =>
    onChange({ ...value, ...patch });

  const countActive = (keys: (keyof AudienceFilter)[]): number =>
    keys.reduce((n, k) => {
      const v = value[k];
      if (Array.isArray(v)) return n + (v.length > 0 ? 1 : 0);
      return n + (v != null ? 1 : 0);
    }, 0);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-text-secondary animate-pulse">
        Loading filter options…
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* Active filter summary */}
      <ActiveSummary
        value={value}
        options={options}
        onClear={(patch) => onChange({ ...value, ...patch })}
      />

      {/* ── Groups (primary) ─────────────────────────────────────────── */}
      <Section
        title="Groups"
        badge={countActive(['group_ids'])}
        defaultOpen={(value.group_ids?.length ?? 0) > 0}
      >
        {(options?.groups.length ?? 0) === 0 ? (
          <p className="text-xs text-text-secondary italic">
            No groups yet — create groups in the Contacts page to use them here.
          </p>
        ) : (
          <CheckboxList
            items={options?.groups ?? []}
            selectedIds={value.group_ids ?? []}
            onToggle={(id) => update({ group_ids: toggleId(value.group_ids, id) })}
          />
        )}
      </Section>

      {/* ── Tags ─────────────────────────────────────────────────────── */}
      <Section
        title="Tags"
        badge={countActive(['tag_ids'])}
        defaultOpen={(value.tag_ids?.length ?? 0) > 0}
      >
        <CheckboxList
          items={options?.tags ?? []}
          selectedIds={value.tag_ids ?? []}
          onToggle={(id) => update({ tag_ids: toggleId(value.tag_ids, id) })}
        />
      </Section>

      {/* ── Priority ─────────────────────────────────────────────────── */}
      <Section
        title="Priority"
        badge={countActive(['priority'])}
        defaultOpen={(value.priority?.length ?? 0) > 0}
      >
        <PillGroup
          options={PRIORITY_OPTIONS}
          selected={value.priority ?? []}
          onToggle={(v) => update({ priority: toggleStr(value.priority, v) })}
        />
      </Section>

      {/* ── Source Channel ────────────────────────────────────────────── */}
      <Section
        title="Source Channel"
        badge={countActive(['source_channels'])}
        defaultOpen={(value.source_channels?.length ?? 0) > 0}
      >
        <PillGroup
          options={options?.sources ?? []}
          selected={value.source_channels ?? []}
          onToggle={(v) => update({ source_channels: toggleStr(value.source_channels, v) })}
        />
      </Section>

      {/* ── Activity / Recency ────────────────────────────────────────── */}
      <Section
        title="Activity"
        badge={countActive(['last_messaged_within_days', 'not_messaged_within_days'])}
        defaultOpen={!!(value.last_messaged_within_days || value.not_messaged_within_days)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Active within (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={value.last_messaged_within_days ?? ''}
                onChange={(e) =>
                  update({
                    last_messaged_within_days: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 7"
                className="w-full px-2.5 py-1.5 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
              {value.last_messaged_within_days && (
                <button type="button" onClick={() => update({ last_messaged_within_days: undefined })}>
                  <X className="h-3.5 w-3.5 text-text-secondary hover:text-red-500" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Contacts updated in the last N days
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Silent for (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={value.not_messaged_within_days ?? ''}
                onChange={(e) =>
                  update({
                    not_messaged_within_days: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 14"
                className="w-full px-2.5 py-1.5 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
              {value.not_messaged_within_days && (
                <button type="button" onClick={() => update({ not_messaged_within_days: undefined })}>
                  <X className="h-3.5 w-3.5 text-text-secondary hover:text-red-500" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Contacts not updated for N+ days
            </p>
          </div>
        </div>
      </Section>

      {/* ── Date Joined ──────────────────────────────────────────────── */}
      <Section
        title="Date Added"
        badge={countActive(['created_after', 'created_before'])}
        defaultOpen={!!(value.created_after || value.created_before)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Added after
            </label>
            <input
              type="date"
              value={value.created_after ?? ''}
              onChange={(e) => update({ created_after: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Added before
            </label>
            <input
              type="date"
              value={value.created_before ?? ''}
              onChange={(e) => update({ created_before: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </Section>

    </div>
  );
}
