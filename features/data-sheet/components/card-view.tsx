'use client';

import { useMemo, useState } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import type { QueryResponse } from '@/features/data-sheet/api';
import type { CardViewConfig } from '@/features/data-sheet/state/view-state';
import { FieldLabelValue } from '@/components/data-sheet/field-display';

type RecordItem = QueryResponse['items'][number];

interface CardViewProps {
  items: RecordItem[];
  fields: DynamicField[];
  config: CardViewConfig;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onViewDetail: (row: { id: number; data: Record<string, unknown>; recordKey: string }) => void;
  onDeleteRow: (id: number) => void;
}

export function CardView({
  items,
  fields,
  config,
  selectedIds,
  onToggleSelect,
  onViewDetail,
  onDeleteRow,
}: CardViewProps) {
  const cardFields = useMemo(() => {
    if (config.cardFields && config.cardFields.length > 0) {
      return fields.filter((f) => config.cardFields!.includes(f.name));
    }
    // Default: first 4 non-relation/non-file fields
    return fields
      .filter((f) => !['image', 'file', 'relation'].includes(f.field_type))
      .slice(0, 4);
  }, [fields, config.cardFields]);

  // Find a "title" field: first text field, or first field overall
  const titleField = useMemo(() => {
    return fields.find((f) => f.field_type === 'text') || fields[0] || null;
  }, [fields]);

  const gridClass =
    config.gridCols === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : config.gridCols === 4
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-sm text-text-secondary">
        No records yet. Click the button above to add your first entry.
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {items.map((row) => {
        const recordId = Number(row.id);
        const data = (row.data ?? row.normalized_data ?? {}) as Record<string, unknown>;
        const isSelected = selectedIds.has(recordId);
        const titleValue = titleField ? data[titleField.name] : null;
        const title = titleValue ? String(titleValue) : String(row.record_key ?? row.id);

        return (
          <div
            key={recordId}
            className={`group relative flex flex-col rounded-xl border bg-card-bg shadow-sm transition-all hover:shadow-md ${
              isSelected
                ? 'border-accent ring-2 ring-accent/20'
                : 'border-border-color hover:border-accent/40'
            }`}
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-border-color px-4 py-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(recordId)}
                className="mt-1 shrink-0"
                aria-label={`Select ${title}`}
              />
              <div className="min-w-0 flex-1">
                <h4
                  className="truncate text-sm font-semibold text-text-primary cursor-pointer hover:text-accent"
                  onClick={() => onViewDetail({ id: recordId, data, recordKey: String(row.record_key ?? row.id) })}
                  title={title}
                >
                  {title}
                </h4>
                <p className="text-xs text-text-secondary">
                  {String(row.record_key ?? `#${row.id}`)}
                </p>
              </div>
            </div>

            {/* Body: field values */}
            <div className="flex-1 space-y-2 px-4 py-3">
              {cardFields.map((field) => {
                if (field.name === titleField?.name) return null;
                return (
                  <FieldLabelValue
                    key={field.id}
                    field={field}
                    value={data[field.name]}
                    density="comfortable"
                    layout="inline"
                  />
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border-color px-4 py-2">
              <span className="text-[10px] text-text-secondary">
                {row.updated_at
                  ? new Date(String(row.updated_at)).toLocaleDateString()
                  : row.created_at
                    ? new Date(String(row.created_at)).toLocaleDateString()
                    : ''}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onViewDetail({ id: recordId, data, recordKey: String(row.record_key ?? row.id) })}
                  className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRow(recordId)}
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  Card View Settings Popover                      */
/* ─────────────────────────────────────────────── */

interface CardViewSettingsProps {
  fields: DynamicField[];
  config: CardViewConfig;
  onChange: (config: CardViewConfig) => void;
  open: boolean;
  onClose: () => void;
}

export function CardViewSettings({ fields, config, onChange, open, onClose }: CardViewSettingsProps) {
  const [localFields, setLocalFields] = useState<string[]>(
    config.cardFields ?? fields.filter((f) => !['image', 'file', 'relation'].includes(f.field_type)).slice(0, 4).map((f) => f.name),
  );
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(config.gridCols);

  if (!open) return null;

  const toggleField = (name: string) => {
    setLocalFields((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleApply = () => {
    onChange({ cardFields: localFields.length > 0 ? localFields : null, gridCols });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-color bg-card-bg p-4 shadow-xl sm:p-5">
        <h3 className="text-sm font-semibold text-text-primary">Card View Settings</h3>

        {/* Grid columns */}
        <div className="mt-3">
          <label className="text-xs font-medium text-text-secondary">Grid columns</label>
          <div className="mt-1 flex gap-2">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGridCols(n)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  gridCols === n
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border-color text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                {n} cols
              </button>
            ))}
          </div>
        </div>

        {/* Field selection */}
        <div className="mt-3">
          <label className="text-xs font-medium text-text-secondary">Fields to display on cards</label>
          <div className="mt-1 max-h-[200px] space-y-0.5 overflow-y-auto">
            {fields
              .filter((f) => !['image', 'file'].includes(f.field_type))
              .map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFields.includes(f.name)}
                    onChange={() => toggleField(f.name)}
                  />
                  <span className="text-sm text-text-primary">{f.display_name}</span>
                  <span className="ml-auto text-[10px] text-text-secondary">{f.field_type}</span>
                </label>
              ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Apply
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-border-color px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
