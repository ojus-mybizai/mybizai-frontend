'use client';

import { useEffect, useRef, useState } from 'react';
import { listLeadFields, type LeadFieldConfig, type EntityType } from '@/services/lead-fields';
import { listWork } from '@/services/work';
import { listOrders } from '@/services/orders';
import { listAppointments } from '@/services/appointments';
import { listContacts } from '@/services/contacts';
import { listEmployees } from '@/services/employees';
import { queryRecords } from '@/services/dynamic-data';

// ─── Relation value type (stored in extra_data) ───────────────────────────────

export interface RelationValue {
  id: number;
  label: string;
}

// ─── Entity type mapping for createLeadEntityLink ────────────────────────────

export const RELATION_ENTITY_TYPE_MAP: Record<string, EntityType | null> = {
  work: null,               // Work has no EntityType in LeadEntityLink
  order: 'order',
  appointment: 'appointment',
  contact: 'contact',
  employee: 'employee',
  datasheet: 'datasheet_record',
};

// ─── Relation target display metadata ────────────────────────────────────────

const RELATION_META: Record<string, { icon: string; label: string }> = {
  work:        { icon: '🔧', label: 'Work Item' },
  order:       { icon: '🛒', label: 'Order' },
  appointment: { icon: '📆', label: 'Appointment' },
  contact:     { icon: '👤', label: 'Contact' },
  employee:    { icon: '👥', label: 'Employee' },
  datasheet:   { icon: '🗄', label: 'Record' },
};

// ─── Form field filter ────────────────────────────────────────────────────────

const FORM_FILTER = (f: LeadFieldConfig) => !f.is_system && f.is_visible;

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  value: Record<string, unknown>;
  onChange?: (v: Record<string, unknown>) => void;
  readonly?: boolean;
  /** Pre-fetched fields from parent — skips the internal fetch when provided. */
  fields?: LeadFieldConfig[];
}

/**
 * Renders input controls for all non-system custom lead fields (including relation fields).
 * If `fields` prop is provided, uses it directly (no fetch).
 * Otherwise fetches from the API on mount.
 * Values are keyed by field_key and stored in `extra_data`.
 * Relation field values are stored as `{ id, label }` objects.
 */
export function DynamicLeadFieldsInput({ value, onChange, readonly = false, fields: fieldsProp }: Props) {
  const [fetchedFields, setFetchedFields] = useState<LeadFieldConfig[]>([]);
  const [loading, setLoading] = useState(!fieldsProp);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (fieldsProp !== undefined) return;
    setLoading(true);
    setFetchError(null);
    listLeadFields()
      .then((all) =>
        setFetchedFields(
          all.filter(FORM_FILTER).sort((a, b) => a.column_order - b.column_order),
        ),
      )
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load fields');
      })
      .finally(() => setLoading(false));
  }, [fieldsProp]);

  const fields = fieldsProp !== undefined
    ? fieldsProp.filter(FORM_FILTER).sort((a, b) => a.column_order - b.column_order)
    : fetchedFields;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-text-secondary">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        Loading fields…
      </div>
    );
  }

  if (fetchError) {
    return <p className="text-xs text-red-500">Could not load custom fields: {fetchError}</p>;
  }

  if (fields.length === 0) {
    return (
      <p className="text-xs text-text-secondary italic">
        No custom fields configured.{' '}
        <span className="not-italic">Use the ⚙ Columns button to add fields.</span>
      </p>
    );
  }

  function handleChange(key: string, val: unknown) {
    if (onChange) onChange({ ...value, [key]: val });
  }

  if (readonly) {
    const hasAnyValue = fields.some(
      (f) => value[f.field_key] !== undefined && value[f.field_key] !== null && value[f.field_key] !== '',
    );

    if (!hasAnyValue) {
      return <p className="text-sm text-text-secondary">No custom field values set.</p>;
    }

    return (
      <dl className="space-y-1.5">
        {fields.map((field) => {
          const val = value[field.field_key];
          if (val === undefined || val === null || val === '') return null;
          return (
            <div key={field.id} className="flex items-start justify-between gap-4">
              <dt className="text-sm text-text-secondary shrink-0">{field.display_name}</dt>
              <dd className="text-sm text-text-primary text-right">
                <ReadonlyFieldValue field={field} value={val} />
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {field.display_name}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <FieldInput field={field} value={value[field.field_key]} onChange={(v) => handleChange(field.field_key, v)} />
          {field.config && (field.config as Record<string, unknown>).description ? (
            <p className="mt-1 text-xs text-text-secondary">
              {String((field.config as Record<string, unknown>).description)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Read-only value renderer ─────────────────────────────────────────────────

function ReadonlyFieldValue({ field, value }: { field: LeadFieldConfig; value: unknown }) {
  const str = String(value);

  if (field.field_type === 'relation') {
    const cfg = field.config as { target?: string } | undefined;
    const meta = RELATION_META[cfg?.target ?? ''] ?? { icon: '⇢', label: 'Linked Record' };
    if (value && typeof value === 'object' && 'label' in (value as object)) {
      const rv = value as RelationValue;
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
          <span>{meta.icon}</span>
          {rv.label}
        </span>
      );
    }
    return <span className="text-text-secondary text-xs">#{str}</span>;
  }

  if (field.field_type === 'boolean') {
    const yes = value === true || str === 'true' || str === '1';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        yes ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
      }`}>
        {yes ? 'Yes' : 'No'}
      </span>
    );
  }

  if (field.field_type === 'select') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
        {str}
      </span>
    );
  }

  if (field.field_type === 'url') {
    return (
      <a href={str} target="_blank" rel="noopener noreferrer" className="text-accent underline text-sm truncate max-w-[200px] block">
        {str}
      </a>
    );
  }

  if (field.field_type === 'date' || field.field_type === 'datetime') {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return (
        <span>
          {field.field_type === 'datetime'
            ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      );
    }
  }

  return <span>{str}</span>;
}

// ─── Editable input per field type ───────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: LeadFieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cfg = field.config as Record<string, unknown> | undefined;
  const cls =
    'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-colors';

  if (field.field_type === 'relation') {
    return <RelationFieldPicker field={field} value={value} onChange={onChange} />;
  }

  if (field.field_type === 'select') {
    const opts = (cfg?.options as string[] | undefined) ?? [];
    return (
      <select className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (field.field_type === 'boolean') {
    const checked = value === true || value === 'true';
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-color'}`}
        >
          <div
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-sm text-text-primary">{checked ? 'Yes' : 'No'}</span>
      </div>
    );
  }

  if (field.field_type === 'textarea') {
    return (
      <textarea
        className={cls}
        rows={3}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${field.display_name.toLowerCase()}…`}
      />
    );
  }

  const typeMap: Record<string, string> = {
    number: 'number',
    email: 'email',
    phone: 'tel',
    date: 'date',
    datetime: 'datetime-local',
    url: 'url',
    text: 'text',
  };

  return (
    <input
      type={typeMap[field.field_type] ?? 'text'}
      className={cls}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${field.display_name.toLowerCase()}…`}
    />
  );
}

// ─── Relation field picker ────────────────────────────────────────────────────

async function fetchRelationOptions(
  target: string,
  datasheetId: number | undefined,
  search: string,
): Promise<RelationValue[]> {
  try {
    switch (target) {
      case 'work': {
        const res = await listWork({ q: search || undefined, per_page: 30 });
        return res.items.map((w) => ({ id: w.id, label: w.title || `Work #${w.id}` }));
      }
      case 'order': {
        const orders = await listOrders({});
        const filtered = search
          ? orders.filter((o) => `#${o.id} ${o.status}`.toLowerCase().includes(search.toLowerCase()))
          : orders;
        return filtered.slice(0, 30).map((o) => ({ id: o.id, label: `Order #${o.id} — ${o.status}` }));
      }
      case 'appointment': {
        const appts = await listAppointments({});
        const filtered = search
          ? appts.filter((a) => new Date(a.date_time).toLocaleString().toLowerCase().includes(search.toLowerCase()))
          : appts;
        return filtered.slice(0, 30).map((a) => {
          const d = new Date(a.date_time);
          return {
            id: a.id,
            label: d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          };
        });
      }
      case 'contact': {
        const contacts = await listContacts({ search: search || undefined });
        return contacts.slice(0, 30).map((c) => ({
          id: c.id,
          label: c.full_name || c.phone || `Contact #${c.id}`,
        }));
      }
      case 'employee': {
        const employees = await listEmployees();
        const filtered = search
          ? employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
          : employees;
        return filtered.slice(0, 30).map((e) => ({ id: e.id, label: e.name }));
      }
      case 'datasheet': {
        if (!datasheetId) return [];
        const res = await queryRecords(datasheetId, { keyword: search || undefined, per_page: 30 });
        return res.items.map((item) => {
          const id = typeof item.id === 'number' ? item.id : 0;
          const label =
            (Object.entries(item).find(([k, v]) => k !== 'id' && typeof v === 'string' && v)?.[1] as string | undefined)
            ?? `Record #${id}`;
          return { id, label };
        });
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

function RelationFieldPicker({
  field,
  value,
  onChange,
}: {
  field: LeadFieldConfig;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cfg = field.config as { target?: string; datasheet_id?: number } | undefined;
  const target = cfg?.target ?? '';
  const datasheetId = cfg?.datasheet_id;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<RelationValue[]>([]);
  const [optLoading, setOptLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected =
    value && typeof value === 'object' && 'id' in (value as object)
      ? (value as RelationValue)
      : null;

  // Load options when dropdown opens or search changes
  useEffect(() => {
    if (!open) return;
    setOptLoading(true);
    fetchRelationOptions(target, datasheetId, search)
      .then(setOptions)
      .finally(() => setOptLoading(false));
  }, [open, target, datasheetId, search]);

  // Focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const meta = RELATION_META[target] ?? { icon: '⇢', label: target };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-left transition-colors hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {selected ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span>{meta.icon}</span>
            <span className="truncate text-text-primary">{selected.label}</span>
          </span>
        ) : (
          <span className="text-text-secondary/60 text-sm">Pick {meta.label}…</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-0.5 rounded hover:bg-bg-secondary text-text-secondary hover:text-red-500 transition-colors cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg className={`h-4 w-4 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border-color bg-card-bg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border-color">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${meta.label.toLowerCase()}…`}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {optLoading ? (
              <div className="flex items-center justify-center py-5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : options.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-5">No records found</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors hover:bg-bg-secondary ${
                    selected?.id === opt.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary'
                  }`}
                >
                  <span className="shrink-0">{meta.icon}</span>
                  <span className="flex-1 truncate">{opt.label}</span>
                  <span className="ml-auto text-[10px] text-text-secondary shrink-0 font-mono">#{opt.id}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
