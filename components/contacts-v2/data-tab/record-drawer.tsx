'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  X,
  ExternalLink,
  Loader2,
  Link2Off,
  Trash2,
  Pencil,
  Check,
} from 'lucide-react';
import {
  type ContactDataSection,
  type DynamicField,
  type LinkedRecordItem,
} from '@/services/dynamic-data';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';
import { FieldDisplay } from '@/components/data-sheet/field-display';

/** Types whose editing we defer to the full record page in v1. */
const FULL_PAGE_TYPES = ['image', 'file'];

export function RecordDrawer({
  section,
  record,
  canManage,
  onClose,
  onSaveField,
  onUnlink,
  onDelete,
}: {
  section: ContactDataSection;
  record: LinkedRecordItem;
  canManage: boolean;
  onClose: () => void;
  onSaveField: (fieldName: string, value: unknown) => Promise<void>;
  onUnlink: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [footerBusy, setFooterBusy] = useState<null | 'unlink' | 'delete'>(null);
  const fullPageHref = `/data-sheet/${section.model_id}/${record.id}`;

  const beginEdit = (f: DynamicField) => {
    setEditing(f.name);
    setDraft(record.data[f.name] ?? null);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await onSaveField(editing, draft);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const runFooter = async (kind: 'unlink' | 'delete', fn: () => Promise<void>, msg: string) => {
    if (footerBusy) return;
    if (!window.confirm(msg)) return;
    setFooterBusy(kind);
    try {
      await fn();
    } finally {
      setFooterBusy(null);
    }
  };

  const renderFieldRow = (f: DynamicField) => {
    const isContactRelation = f.id === section.relation_field_id;
    const value = record.data[f.name];

    // The relation that links this record to the contact.
    if (isContactRelation) {
      return (
        <div key={f.id} className="space-y-1 border-b border-border-color/60 py-3 last:border-b-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {f.display_name}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
              Linked to this contact
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() =>
                  runFooter('unlink', onUnlink, 'Unlink this record from the contact? The record is kept.')
                }
                disabled={footerBusy !== null}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline disabled:opacity-50"
              >
                {footerBusy === 'unlink' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2Off className="h-3.5 w-3.5" />
                )}
                Unlink
              </button>
            )}
          </div>
        </div>
      );
    }

    const deferToFullPage = FULL_PAGE_TYPES.includes(f.field_type) || f.field_type === 'relation';
    const readOnly = deferToFullPage || f.field_type === 'computed' || !f.is_editable || !canManage;
    const isEditingThis = editing === f.name;

    return (
      <div key={f.id} className="group/field space-y-1 border-b border-border-color/60 py-3 last:border-b-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {f.display_name}
          </p>
          {!readOnly && !isEditingThis && (
            <button
              type="button"
              onClick={() => beginEdit(f)}
              className="rounded p-0.5 text-text-secondary opacity-0 transition-opacity hover:text-accent group-hover/field:opacity-100"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isEditingThis ? (
          <div className="space-y-2">
            <DatasheetFieldInput field={f} value={draft} onChange={setDraft} autoFocus />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border-color px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : deferToFullPage ? (
          <Link href={fullPageHref} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-accent">
            Manage on full page <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => (readOnly ? undefined : beginEdit(f))}
            className={`block w-full text-left ${readOnly ? 'cursor-default' : 'cursor-text'}`}
          >
            <FieldDisplay field={f} value={value} density="detail" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[480px] flex-col border-l border-border-color bg-card-bg shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border-color p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {record.title || record.record_key}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-text-secondary">
              {record.record_key} · {section.model_display_name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={fullPageHref}
              className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2 py-1.5 text-xs font-medium text-text-primary hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
              title="Open full page"
            >
              Open <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4">
          {section.fields.length === 0 ? (
            <p className="py-6 text-sm text-text-secondary">This sheet has no fields.</p>
          ) : (
            section.fields.map(renderFieldRow)
          )}
        </div>

        {/* Footer */}
        {canManage && (
          <footer className="flex items-center gap-2 border-t border-border-color p-4">
            <button
              type="button"
              onClick={() =>
                runFooter('unlink', onUnlink, 'Unlink this record from the contact? The record is kept.')
              }
              disabled={footerBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-primary hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-600 disabled:opacity-50"
            >
              {footerBusy === 'unlink' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2Off className="h-3.5 w-3.5" />
              )}
              Unlink from contact
            </button>
            <button
              type="button"
              onClick={() =>
                runFooter('delete', onDelete, 'Delete this record permanently? This cannot be undone.')
              }
              disabled={footerBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-red-500 hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
            >
              {footerBusy === 'delete' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete record
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
