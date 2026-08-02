'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Link2Off, Trash2, Loader2 } from 'lucide-react';
import {
  type ContactDataSection,
  type DynamicField,
  type LinkedRecordItem,
} from '@/services/dynamic-data';
import { FieldDisplay } from '@/components/data-sheet/field-display';

/** Up to two secondary fields (status/number/currency-ish) with a value. */
function pickSecondaryFields(
  fields: DynamicField[],
  titleFieldName: string | null,
  relationFieldId: number,
  data: Record<string, unknown>,
): DynamicField[] {
  const out: DynamicField[] = [];
  const preferred = ['enum', 'currency', 'number', 'date', 'boolean'];
  for (const ft of preferred) {
    for (const f of fields) {
      if (out.length >= 2) return out;
      if (f.field_type !== ft) continue;
      if (f.name === titleFieldName) continue;
      if (f.id === relationFieldId) continue;
      const v = data[f.name];
      if (v === null || v === undefined || v === '') continue;
      if (!out.includes(f)) out.push(f);
    }
  }
  return out.slice(0, 2);
}

export function RecordListRow({
  section,
  record,
  canManage,
  onOpenDrawer,
  onUnlink,
  onDelete,
}: {
  section: ContactDataSection;
  record: LinkedRecordItem;
  canManage: boolean;
  onOpenDrawer: () => void;
  onUnlink: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<null | 'unlink' | 'delete'>(null);

  const secondaries = useMemo(
    () =>
      pickSecondaryFields(
        section.fields,
        section.title_field,
        section.relation_field_id,
        record.data,
      ),
    [section.fields, section.title_field, section.relation_field_id, record.data],
  );

  const run = async (kind: 'unlink' | 'delete', fn: () => Promise<void>, confirmMsg: string) => {
    if (busy) return;
    if (!window.confirm(confirmMsg)) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onOpenDrawer}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {record.title || record.record_key}
          </span>
          {secondaries.map((f) => (
            <span key={f.id} className="shrink-0">
              <FieldDisplay field={f} value={record.data[f.name]} density="compact" />
            </span>
          ))}
        </div>
        <p className="truncate font-mono text-[11px] text-text-secondary">
          {record.record_key}
        </p>
      </button>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Link
          href={`/data-sheet/${section.model_id}/${record.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
          title="Open full page"
        >
          Open <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() =>
                run(
                  'unlink',
                  onUnlink,
                  `Unlink "${record.title || record.record_key}" from this contact? The record is kept, only the link is removed.`,
                )
              }
              disabled={busy !== null}
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-amber-500/10 hover:text-amber-600 disabled:opacity-50"
              title="Unlink from contact"
            >
              {busy === 'unlink' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2Off className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  'delete',
                  onDelete,
                  `Delete "${record.title || record.record_key}" permanently? This cannot be undone.`,
                )
              }
              disabled={busy !== null}
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
              title="Delete record"
            >
              {busy === 'delete' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
