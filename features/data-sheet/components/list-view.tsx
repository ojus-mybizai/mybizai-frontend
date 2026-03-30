'use client';

import { useMemo, useState } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import type { QueryResponse } from '@/features/data-sheet/api';
import type { ListViewConfig } from '@/features/data-sheet/state/view-state';

type RecordItem = QueryResponse['items'][number];

function formatValue(field: DynamicField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.field_type) {
    case 'boolean':
      return value === true || value === 'true' || value === 1 ? 'Yes' : 'No';
    case 'currency': {
      const code = (field.config?.currency_code as string) || 'USD';
      const num = Number(value);
      if (!Number.isFinite(num)) return String(value);
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(num);
      } catch {
        return `${code} ${num.toFixed(2)}`;
      }
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString() : String(value);
    }
    case 'date': {
      try {
        const d = new Date(String(value));
        return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    case 'relation':
      if (Array.isArray(value)) return `${value.length} linked`;
      return value ? '1 linked' : '—';
    case 'image':
    case 'file':
      return 'Attachment';
    default: {
      const s = String(value);
      return s.length > 80 ? s.slice(0, 80) + '...' : s;
    }
  }
}

interface ListViewProps {
  items: RecordItem[];
  fields: DynamicField[];
  config: ListViewConfig;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onViewDetail: (row: { id: number; data: Record<string, unknown>; recordKey: string }) => void;
  onDeleteRow: (id: number) => void;
}

export function ListView({
  items,
  fields,
  config,
  selectedIds,
  onToggleSelect,
  onViewDetail,
  onDeleteRow,
}: ListViewProps) {
  const titleField = useMemo(() => {
    if (config.titleField) {
      return fields.find((f) => f.name === config.titleField) || null;
    }
    return fields.find((f) => f.field_type === 'text') || fields[0] || null;
  }, [fields, config.titleField]);

  const detailFields = useMemo(() => {
    if (config.detailFields && config.detailFields.length > 0) {
      return fields.filter((f) => config.detailFields!.includes(f.name));
    }
    return fields
      .filter((f) => f.name !== titleField?.name && !['image', 'file'].includes(f.field_type))
      .slice(0, 3);
  }, [fields, config.detailFields, titleField]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-sm text-text-secondary">
        No records yet. Click the button above to add your first entry.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
      {items.map((row, idx) => {
        const recordId = Number(row.id);
        const data = (row.data ?? row.normalized_data ?? {}) as Record<string, unknown>;
        const isSelected = selectedIds.has(recordId);
        const titleValue = titleField ? data[titleField.name] : null;
        const title = titleValue ? String(titleValue) : String(row.record_key ?? row.id);

        return (
          <div
            key={recordId}
            className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-secondary/60 ${
              idx !== 0 ? 'border-t border-border-color' : ''
            } ${isSelected ? 'bg-accent/5' : ''}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(recordId)}
              className="shrink-0"
              aria-label={`Select ${title}`}
            />

            {/* Avatar / initial */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
              {title.charAt(0).toUpperCase()}
            </div>

            {/* Content */}
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => onViewDetail({ id: recordId, data, recordKey: String(row.record_key ?? row.id) })}
            >
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-semibold text-text-primary hover:text-accent">
                  {title}
                </h4>
                <span className="shrink-0 text-[10px] text-text-secondary">
                  {String(row.record_key ?? `#${row.id}`)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {detailFields.map((field) => {
                  const value = data[field.name];
                  const formatted = formatValue(field, value);
                  if (formatted === '—') return null;

                  return (
                    <span key={field.id} className="flex items-center gap-1 text-xs text-text-secondary">
                      <span className="font-medium">{field.display_name}:</span>
                      {field.field_type === 'enum' && value ? (
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          {String(value)}
                        </span>
                      ) : field.field_type === 'boolean' ? (
                        <span className="flex items-center gap-0.5">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                            value === true || value === 'true' || value === 1
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`} />
                          {formatted}
                        </span>
                      ) : (
                        <span className="truncate">{formatted}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Timestamp */}
            <span className="hidden shrink-0 text-[10px] text-text-secondary sm:block">
              {row.updated_at
                ? new Date(String(row.updated_at)).toLocaleDateString()
                : row.created_at
                  ? new Date(String(row.created_at)).toLocaleDateString()
                  : ''}
            </span>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  List View Settings Popover                      */
/* ─────────────────────────────────────────────── */

interface ListViewSettingsProps {
  fields: DynamicField[];
  config: ListViewConfig;
  onChange: (config: ListViewConfig) => void;
  open: boolean;
  onClose: () => void;
}

export function ListViewSettings({ fields, config, onChange, open, onClose }: ListViewSettingsProps) {
  const textFields = fields.filter((f) => ['text', 'number', 'currency', 'enum', 'date'].includes(f.field_type));
  const [titleField, setTitleField] = useState<string | null>(config.titleField);
  const [detailFields, setDetailFields] = useState<string[]>(
    config.detailFields ?? fields.filter((f) => !['image', 'file'].includes(f.field_type)).slice(0, 3).map((f) => f.name),
  );

  if (!open) return null;

  const toggleDetail = (name: string) => {
    setDetailFields((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleApply = () => {
    onChange({ titleField, detailFields: detailFields.length > 0 ? detailFields : null });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-color bg-card-bg p-4 shadow-xl sm:p-5">
        <h3 className="text-sm font-semibold text-text-primary">List View Settings</h3>

        {/* Title field */}
        <div className="mt-3">
          <label className="text-xs font-medium text-text-secondary">Title field</label>
          <select
            value={titleField ?? ''}
            onChange={(e) => setTitleField(e.target.value || null)}
            className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          >
            <option value="">Auto (first text field)</option>
            {textFields.map((f) => (
              <option key={f.id} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        </div>

        {/* Detail fields */}
        <div className="mt-3">
          <label className="text-xs font-medium text-text-secondary">Detail fields (shown below title)</label>
          <div className="mt-1 max-h-[200px] space-y-0.5 overflow-y-auto">
            {fields
              .filter((f) => !['image', 'file'].includes(f.field_type))
              .map((f) => (
                <label key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detailFields.includes(f.name)}
                    onChange={() => toggleDetail(f.name)}
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
