'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { queryRecords } from '@/services/dynamic-data';
import { useDatasheetSchema } from '@/hooks/use-datasheet-schema';

const HARD_CAP = 200;

export function RowPicker({
  datasheetId,
  multi,
  selected,
  onChange,
}: {
  datasheetId: number;
  multi: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const { data: fields } = useDatasheetSchema(datasheetId);
  const query = useQuery({
    queryKey: ['row-picker', datasheetId],
    queryFn: () => queryRecords(datasheetId, { page: 1, per_page: HARD_CAP }),
    staleTime: 30_000,
  });

  const labelField = useMemo(() => {
    if (!fields) return null;
    const preferred = ['product_name', 'name', 'title', 'display_name'];
    for (const p of preferred) {
      const f = fields.find((x) => x.name === p);
      if (f) return f.name;
    }
    return fields.find((x) => x.field_type === 'text')?.name ?? null;
  }, [fields]);

  const rows = useMemo(() => {
    const items = (query.data?.items ?? []) as Array<Record<string, unknown>>;
    const needle = q.toLowerCase().trim();
    return items
      .map((r) => {
        const data = (r.data ?? r) as Record<string, unknown>;
        const idRaw = (r.id ?? data.id) as number | string | undefined;
        const id = typeof idRaw === 'string' ? Number(idRaw) : (idRaw as number);
        const label =
          (labelField ? String(data[labelField] ?? '') : '') ||
          String(r.record_key ?? data.record_key ?? '') ||
          `Record #${id}`;
        const secondary = (r.record_key ?? data.record_key ?? '') as string;
        return { id, label, secondary };
      })
      .filter(
        (r) =>
          Number.isFinite(r.id) &&
          (!needle ||
            r.label.toLowerCase().includes(needle) ||
            (r.secondary && r.secondary.toString().toLowerCase().includes(needle))),
      );
  }, [query.data, q, labelField]);

  const toggle = (id: number) => {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    } else {
      onChange(selected[0] === id ? [] : [id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-tc-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rows…"
          className="w-full rounded border border-tc-rule bg-tc-bg-ground py-1.5 pl-7 pr-2 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
        />
      </div>
      {query.isLoading ? (
        <div className="flex items-center justify-center gap-1 py-4 text-xs text-tc-ink-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading rows…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-tc-ink-muted">
          No matching rows. Loosen your search.
        </div>
      ) : (
        <ul className="max-h-56 overflow-y-auto rounded border border-tc-rule">
          {rows.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-2 border-b border-tc-rule px-2 py-1.5 last:border-b-0 hover:bg-tc-bg-card-2">
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  checked={selected.includes(r.id)}
                  onChange={() => toggle(r.id)}
                  className="accent-tc-accent"
                />
                <span className="flex-1 truncate text-xs text-tc-ink">{r.label}</span>
                {r.secondary && r.secondary !== r.label && (
                  <span className="font-mono text-[10px] text-tc-ink-muted">{r.secondary}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="text-[11px] text-tc-ink-muted">
        {selected.length} of {rows.length} selected
        {query.data && query.data.total > rows.length && (
          <span> · {query.data.total} total</span>
        )}
      </div>
    </div>
  );
}
