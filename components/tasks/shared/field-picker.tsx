'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, User, Database, Sparkles } from 'lucide-react';
import { useDatasheetSchema } from '@/hooks/use-datasheet-schema';
import { UNIVERSAL_TOKENS } from '@/lib/tasks/tokens';
import type { EntityKind } from '@/services/taskTemplates';

const CONTACT_FIELDS = [
  { path: 'contact.name', label: 'Contact name' },
  { path: 'contact.phone', label: 'Contact phone' },
  { path: 'contact.email', label: 'Contact email' },
];

export interface FieldChoice {
  source: 'datasheet' | 'contact' | 'universal' | 'free';
  path: string;
  fieldType?: string;
  label: string;
}

export function FieldPicker({
  entityKind,
  datasheetId,
  datasheetName,
  onPick,
  onClose,
}: {
  entityKind: EntityKind;
  datasheetId?: number | null;
  datasheetName?: string | null;
  onPick: (choice: FieldChoice) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: fields, isLoading } = useDatasheetSchema(
    entityKind === 'datasheet' ? datasheetId ?? undefined : undefined,
  );

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const groups = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const dsChoices: FieldChoice[] =
      entityKind === 'datasheet' && datasheetId != null && fields
        ? fields.map((f) => ({
            source: 'datasheet' as const,
            path: `${datasheetName ?? 'record'}.${f.name}`,
            fieldType: f.field_type,
            label: f.display_name,
          }))
        : [];
    const contactChoices: FieldChoice[] =
      entityKind === 'contact'
        ? CONTACT_FIELDS.map((c) => ({
            source: 'contact' as const,
            path: c.path,
            label: c.label,
          }))
        : [];
    const universalChoices: FieldChoice[] = UNIVERSAL_TOKENS.map((t) => ({
      source: 'universal' as const,
      path: t.path,
      label: t.label,
      fieldType: t.hint,
    }));

    const match = (c: FieldChoice) =>
      !needle ||
      c.label.toLowerCase().includes(needle) ||
      c.path.toLowerCase().includes(needle);

    return [
      { label: 'Datasheet fields', items: dsChoices.filter(match) },
      { label: 'Contact fields', items: contactChoices.filter(match) },
      { label: 'Dynamic', items: universalChoices.filter(match) },
    ].filter((g) => g.items.length > 0);
  }, [q, fields, entityKind, datasheetId, datasheetName]);

  const noResults = groups.length === 0;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Insert field"
      className="absolute z-50 mt-1 w-72 rounded-tc-panel border border-tc-rule bg-tc-bg-card shadow-[var(--tc-shadow-soft)]"
    >
      <div className="border-b border-tc-rule p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-tc-ink-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fields…"
            className="w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground py-1 pl-7 pr-2 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {isLoading && entityKind === 'datasheet' && (
          <div className="flex items-center justify-center gap-1 py-4 text-xs text-tc-ink-muted">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading schema…
          </div>
        )}
        {!isLoading && noResults && (
          <div className="py-4 text-center text-xs text-tc-ink-muted">No fields.</div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
              {g.label}
            </div>
            {g.items.map((c) => (
              <button
                key={`${c.source}:${c.path}`}
                onClick={() => {
                  onPick(c);
                  onClose();
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-tc-bg-card-2"
              >
                {c.source === 'contact' ? (
                  <User className="h-3 w-3 shrink-0 text-tc-ink-muted" />
                ) : c.source === 'universal' ? (
                  <Sparkles className="h-3 w-3 shrink-0 text-tc-ink-muted" />
                ) : (
                  <Database className="h-3 w-3 shrink-0 text-tc-ink-muted" />
                )}
                <span className="flex-1 truncate text-xs text-tc-ink">{c.label}</span>
                <span className="font-mono text-[10px] text-tc-ink-muted">
                  {c.fieldType ?? c.source}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
