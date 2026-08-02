'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  createLinkedRecord,
  type ContactDataSection,
  type DynamicField,
  type LinkedRecordItem,
} from '@/services/dynamic-data';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';

/** Field types the inline create form can render (mirrors record-detail-page). */
const CREATABLE_EXCLUDE = ['relation', 'image', 'file', 'computed'];

export function CreateRecordForm({
  section,
  contactId,
  onCreated,
  onCancel,
}: {
  section: ContactDataSection;
  contactId: number;
  onCreated: (record: LinkedRecordItem) => void;
  onCancel: () => void;
}) {
  const editableFields = useMemo<DynamicField[]>(
    () =>
      section.fields.filter(
        (f) => f.is_editable && !CREATABLE_EXCLUDE.includes(f.field_type),
      ),
    [section.fields],
  );

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (name: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Drop empty values so required/default handling stays server-side.
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== null && v !== undefined && v !== '') data[k] = v;
      }
      const rec = await createLinkedRecord(
        section.model_id,
        data,
        section.relation_field_id,
        contactId,
      );
      onCreated({
        id: rec.id,
        record_key: rec.record_key,
        title: '', // parent recomputes the title from fields
        data: rec.data ?? data,
        created_at: rec.created_at ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-3 space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-primary">
          New {section.model_display_name} record
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-text-secondary hover:text-text-primary"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {editableFields.length === 0 ? (
        <p className="text-xs text-text-secondary">
          This sheet has no editable scalar fields — the record will be created
          linked to this contact. Add more fields on the full datasheet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {editableFields.map((f) => (
            <label key={f.id} className="min-w-0 space-y-1">
              <span className="text-[11px] font-medium text-text-secondary">
                {f.display_name}
                {f.is_required && <span className="text-red-500"> *</span>}
              </span>
              <DatasheetFieldInput
                field={f}
                value={values[f.name]}
                onChange={(v) => setField(f.name, v)}
              />
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Create record
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
