'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { contactsV2Service } from '@/services/contacts-v2';

export function ContactPicker({
  multi,
  selected,
  onChange,
}: {
  multi: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['contact-picker', q],
    queryFn: () => contactsV2Service.list({ search: q || undefined, limit: 200, offset: 0 }),
    staleTime: 15_000,
  });

  const contacts = useMemo(() => query.data?.contacts ?? [], [query.data]);

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
          placeholder="Search contacts…"
          className="w-full rounded border border-tc-rule bg-tc-bg-ground py-1.5 pl-7 pr-2 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
        />
      </div>
      {query.isLoading ? (
        <div className="flex items-center justify-center gap-1 py-4 text-xs text-tc-ink-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading contacts…
        </div>
      ) : contacts.length === 0 ? (
        <div className="py-4 text-center text-xs text-tc-ink-muted">
          No matching contacts.
        </div>
      ) : (
        <ul className="max-h-56 overflow-y-auto rounded border border-tc-rule">
          {contacts.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 border-b border-tc-rule px-2 py-1.5 last:border-b-0 hover:bg-tc-bg-card-2">
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="accent-tc-accent"
                />
                <span className="flex-1 truncate text-xs text-tc-ink">
                  {c.name || c.phone || `Contact #${c.id}`}
                </span>
                {c.phone && (
                  <span className="font-mono text-[10px] text-tc-ink-muted">{c.phone}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="text-[11px] text-tc-ink-muted">
        {selected.length} of {contacts.length} selected
      </div>
    </div>
  );
}
