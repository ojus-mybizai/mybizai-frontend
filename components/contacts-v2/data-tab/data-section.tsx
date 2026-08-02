'use client';

import { useState } from 'react';
import { Table2, Plus } from 'lucide-react';
import {
  type ContactDataSection,
  type LinkedRecordItem,
} from '@/services/dynamic-data';
import { RecordListRow } from './record-list-row';
import { CreateRecordForm } from './create-record-form';

export function DataSection({
  section,
  contactId,
  canManage,
  onOpenDrawer,
  onCreated,
  onUnlink,
  onDelete,
}: {
  section: ContactDataSection;
  contactId: number;
  canManage: boolean;
  onOpenDrawer: (recordId: number) => void;
  onCreated: (record: LinkedRecordItem) => void;
  onUnlink: (record: LinkedRecordItem) => Promise<void>;
  onDelete: (record: LinkedRecordItem) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-bg-primary text-text-secondary">
          <Table2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-text-primary">
            {section.model_display_name}
          </h2>
          <p className="truncate text-[11px] text-text-secondary">
            via {section.relation_field_display_name}
          </p>
        </div>
        <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-bg-primary px-1.5 text-[11px] font-semibold text-text-secondary">
          {section.records.length}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        )}
      </header>

      {creating && (
        <CreateRecordForm
          section={section}
          contactId={contactId}
          onCreated={(rec) => {
            onCreated(rec);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {section.records.length === 0 ? (
        !creating && (
          <p className="py-1 text-sm text-text-secondary">
            No records yet — add the first one.
          </p>
        )
      ) : (
        <ul className="divide-y divide-border-color">
          {section.records.map((r) => (
            <RecordListRow
              key={r.id}
              section={section}
              record={r}
              canManage={canManage}
              onOpenDrawer={() => onOpenDrawer(r.id)}
              onUnlink={() => onUnlink(r)}
              onDelete={() => onDelete(r)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
