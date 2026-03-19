'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import type {
  AgentUIBlock,
  AgentUIBlockSlotForm,
  AgentUIBlockConfirmation,
  AgentUIBlockSuccess,
  AgentUIBlockTable,
  SlotField,
} from './types';

interface AgentActionCardProps {
  block: AgentUIBlock;
  /** Called when user submits a slot form or clicks confirm/cancel */
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function AgentActionCard({ block, onSend, disabled }: AgentActionCardProps) {
  switch (block.type) {
    case 'slot_form':
      return <SlotFormCard block={block} onSend={onSend} disabled={disabled} />;
    case 'confirmation_card':
      return <ConfirmationCard block={block} onSend={onSend} disabled={disabled} />;
    case 'success_card':
      return <SuccessCard block={block} />;
    case 'table':
      return <InlineTable block={block} />;
    default:
      return null;
  }
}

// ─── Shared: CardShell ────────────────────────────────────────────────────────

function CardShell({
  accentClass,
  icon,
  title,
  children,
}: {
  accentClass: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border-color bg-card-bg overflow-hidden border-l-[3px] ${accentClass} w-full`}>
      <div className="flex items-center gap-2 border-b border-border-color bg-bg-secondary px-3.5 py-2.5">
        <span className="shrink-0 text-base leading-none">{icon}</span>
        <span className="text-xs font-semibold text-text-primary">{title}</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

// ─── Shared: DetailRows ───────────────────────────────────────────────────────

function DetailRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border-color bg-bg-secondary divide-y divide-border-color overflow-hidden">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
          <span className="shrink-0 text-text-secondary">{row.label}</span>
          <span className="font-medium text-text-primary text-right break-words max-w-[60%]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared: RichText (bold + newlines) ───────────────────────────────────────

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, pi) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={pi}>{part.slice(2, -2)}</strong>
            : part,
        );
        return (
          <React.Fragment key={li}>
            {rendered}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ─── Slot Form ────────────────────────────────────────────────────────────────

// ─── Validators ───────────────────────────────────────────────────────────────

function validateField(field: SlotField, value: string): string | null {
  const v = value.trim();
  if (field.required && !v) return `${field.label} is required`;
  if (!v) return null; // optional empty fields are fine

  if (field.type === 'email') {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (!ok) return `Enter a valid email — e.g. name@domain.com`;
  }

  if (field.name === 'phone' || field.name.includes('phone')) {
    const digits = v.replace(/\D/g, '');
    if (digits.length < 7) return `Phone must have at least 7 digits`;
    if (digits.length > 20) return `Phone must be 20 digits or fewer`;
  }

  if (field.type === 'number') {
    if (isNaN(Number(v))) return `${field.label} must be a number`;
  }

  return null;
}

// ─── Slot Form ────────────────────────────────────────────────────────────────

function SlotFormCard({
  block,
  onSend,
  disabled,
}: {
  block: AgentUIBlockSlotForm;
  onSend: (msg: string) => void;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of block.fields) {
      init[f.name] = f.value != null ? String(f.value) : (f.default ?? '');
    }
    return init;
  });

  // Seed server-sent errors immediately (e.g. after a failed submit from backend)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of block.fields) {
      if (f.error) init[f.name] = f.error;
    }
    return init;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const f of block.fields) {
      if (f.error) init[f.name] = true;
    }
    return init;
  });

  const handleChange = (name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    // Clear error once user starts editing
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleBlur = (field: SlotField) => {
    setTouched((prev) => ({ ...prev, [field.name]: true }));
    const err = validateField(field, values[field.name] ?? '');
    if (err) setFieldErrors((prev) => ({ ...prev, [field.name]: err }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Run all validations
    const errors: Record<string, string> = {};
    for (const f of block.fields) {
      const err = validateField(f, values[f.name] ?? '');
      if (err) errors[f.name] = err;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Mark all fields as touched so errors show
      const allTouched: Record<string, boolean> = {};
      for (const f of block.fields) allTouched[f.name] = true;
      setTouched(allTouched);
      return;
    }

    onSend(`__SLOTS__:${JSON.stringify(values)}`);
  };

  const handleCancel = () => onSend('__CANCEL__');

  return (
    <CardShell accentClass="border-l-violet-500" icon="✏️" title={block.title || 'Fill in details'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Plan context banner */}
        {block.plan_text && (
          <div className="flex items-start gap-2 rounded-lg bg-accent/8 border border-accent/20 px-3 py-2">
            <svg className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-[11px] text-accent leading-relaxed">
              <RichText text={block.plan_text} />
            </p>
          </div>
        )}
        {block.fields.map((field) => {
          const hasPrefill = field.value != null && field.value !== '';
          const error = touched[field.name] ? fieldErrors[field.name] : undefined;
          return (
            <FieldInput
              key={field.name}
              field={field}
              value={values[field.name] ?? ''}
              onChange={(v) => handleChange(field.name, v)}
              onBlur={() => handleBlur(field)}
              disabled={disabled}
              prefilled={hasPrefill}
              error={error}
            />
          );
        })}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={disabled}
            className="flex-none px-4 py-2 rounded-lg border border-border-color bg-bg-secondary hover:bg-card-bg text-text-secondary text-xs font-medium transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors disabled:opacity-40"
          >
            {block.submit_label || 'Continue →'}
          </button>
        </div>
      </form>
    </CardShell>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  prefilled,
  error,
}: {
  field: SlotField;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  prefilled?: boolean;
  error?: string;
}) {
  const baseClass = `w-full rounded-lg border px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 transition-colors ${
    error
      ? 'border-red-400 bg-red-50/30 dark:bg-red-950/20 focus:border-red-400'
      : 'border-border-color bg-bg-secondary focus:border-accent'
  }`;

  const nativeInputType = (() => {
    switch (field.type) {
      case 'email': return 'email';
      case 'number': return 'number';
      case 'date': return 'date';
      case 'datetime-local': return 'datetime-local';
      case 'time': return 'time';
      default: return 'text';
    }
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-text-primary">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {prefilled && !error && (
          <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent leading-none">
            pre-filled
          </span>
        )}
      </div>
      {field.type === 'textarea' ? (
        <textarea
          className={`${baseClass} resize-none`}
          rows={3}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
        />
      ) : field.type === 'select' ? (
        <select
          className={baseClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      ) : field.type === 'relation' ? (
        <RelationSearchInput
          field={field}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          baseClass={baseClass}
        />
      ) : (
        <input
          type={nativeInputType}
          className={baseClass}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
        />
      )}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-500">
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Relation Search Input ─────────────────────────────────────────────────────

interface RelationRecord {
  id: number;
  data: Record<string, unknown>;
}

function getRecordLabel(rec: RelationRecord): string {
  const d = rec.data || {};
  // Try common name fields first
  for (const k of ['name', 'full_name', 'title', 'label', 'display_name']) {
    if (d[k] && typeof d[k] === 'string') return d[k] as string;
  }
  // Fallback: first string value
  for (const v of Object.values(d)) {
    if (v && typeof v === 'string') return v;
  }
  return `Record #${rec.id}`;
}

function RelationSearchInput({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  baseClass,
}: {
  field: SlotField;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  baseClass: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search the related datasheet
  const search = useCallback(async (kw: string) => {
    if (!field.relation_model_id || !kw.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await apiFetch<{ items?: RelationRecord[] }>(
        `/api/v1/data/models/${field.relation_model_id}/search/full-text`,
        {
          method: 'POST',
          body: JSON.stringify({ keyword: kw, per_page: 8, page: 1 }),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      setResults(resp.items ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [field.relation_model_id]);

  const handleInput = (kw: string) => {
    setQuery(kw);
    if (!kw.trim()) { setResults([]); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(kw), 300);
  };

  const handleSelect = (rec: RelationRecord) => {
    const lbl = getRecordLabel(rec);
    setSelectedLabel(lbl);
    setQuery(lbl);
    onChange(String(rec.id));
    setOpen(false);
    onBlur?.();
  };

  const handleClear = () => {
    setQuery('');
    setSelectedLabel('');
    onChange('');
    setResults([]);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isSelected = !!value && !!selectedLabel;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          className={`${baseClass} pr-8`}
          placeholder={field.placeholder || `Search ${field.relation_display_name || 'record'}…`}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          disabled={disabled}
        />
        {/* Status icons */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <svg className="h-3 w-3 animate-spin text-text-secondary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isSelected && !loading && (
            <button type="button" onClick={handleClear} className="text-text-secondary hover:text-text-primary">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {!isSelected && !loading && (
            <svg className="h-3 w-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Selected badge */}
      {isSelected && (
        <div className="mt-1 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-[11px] text-accent font-medium w-fit">
          <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {selectedLabel}
          <span className="text-text-secondary font-normal">#{value}</span>
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-color bg-card-bg shadow-lg overflow-hidden">
          {results.map((rec) => {
            const lbl = getRecordLabel(rec);
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => handleSelect(rec)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left"
              >
                <span className="truncate">{lbl}</span>
                <span className="shrink-0 text-text-secondary text-[10px]">#{rec.id}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-color bg-card-bg shadow-lg px-3 py-2.5 text-xs text-text-secondary">
          No records found
        </div>
      )}
    </div>
  );
}

// ─── Confirmation Card ────────────────────────────────────────────────────────

function ConfirmationCard({
  block,
  onSend,
  disabled,
}: {
  block: AgentUIBlockConfirmation;
  onSend: (msg: string) => void;
  disabled?: boolean;
}) {
  return (
    <CardShell accentClass="border-l-amber-500" icon="⚡" title={block.title}>
      <div className="space-y-3">
        {block.summary && (
          <p className="text-xs text-text-primary leading-relaxed">
            <RichText text={block.summary} />
          </p>
        )}

        {block.rows && block.rows.length > 0 && (
          <DetailRows rows={block.rows} />
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSend('__CONFIRM__')}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {block.confirm_label || 'Confirm'}
          </button>
          <button
            onClick={() => onSend('__CANCEL__')}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border-color bg-bg-secondary hover:bg-card-bg text-text-primary text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {block.cancel_label || 'Cancel'}
          </button>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Success Card ─────────────────────────────────────────────────────────────

function SuccessCard({ block }: { block: AgentUIBlockSuccess }) {
  return (
    <CardShell accentClass="border-l-green-500" icon="✅" title={block.title}>
      {block.rows && block.rows.length > 0 && (
        <DetailRows rows={block.rows} />
      )}
    </CardShell>
  );
}

// ─── Inline Table ─────────────────────────────────────────────────────────────

const TABLE_PREVIEW_ROWS = 5;

function InlineTable({ block }: { block: AgentUIBlockTable }) {
  const [expanded, setExpanded] = useState(false);

  if (!block.rows || block.rows.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden border-l-[3px] border-l-blue-500 w-full">
        <div className="flex items-center gap-2 border-b border-border-color bg-bg-secondary px-3.5 py-2.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          <span className="text-xs font-semibold text-text-primary">{block.title}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-text-secondary">
          <svg className="h-7 w-7 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">No {block.title?.toLowerCase() || 'data'} found</span>
        </div>
      </div>
    );
  }

  const visibleRows = expanded ? block.rows : block.rows.slice(0, TABLE_PREVIEW_ROWS);
  const hiddenCount = block.rows.length - TABLE_PREVIEW_ROWS;

  // Build a quick lookup: column key → field type
  const colTypeMap = Object.fromEntries(block.columns.map((c) => [c.key, c.type ?? 'text']));

  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden border-l-[3px] border-l-blue-500 w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border-color bg-bg-secondary px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
          </svg>
          <span className="text-xs font-semibold text-text-primary">{block.title}</span>
        </div>
        {block.total != null && (
          <span className="text-[10px] text-text-secondary font-medium">
            {block.total} total
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-color bg-bg-secondary/50">
              {block.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-semibold text-text-secondary whitespace-nowrap uppercase tracking-wide text-[10px]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border-color last:border-b-0 transition-colors hover:bg-bg-secondary/60 ${
                  i % 2 === 1 ? 'bg-bg-secondary/30' : ''
                }`}
              >
                {block.columns.map((col) => {
                  const fieldType = colTypeMap[col.key] ?? 'text';
                  const rawVal = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2 text-text-primary whitespace-nowrap max-w-[240px]"
                    >
                      <MediaCell value={rawVal} fieldType={fieldType} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more / less toggle */}
      {block.rows.length > TABLE_PREVIEW_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-border-color bg-bg-secondary/50 hover:bg-bg-secondary px-3.5 py-2 text-[11px] font-medium text-accent text-center transition-colors"
        >
          {expanded
            ? '▲ Show less'
            : `▼ Show ${hiddenCount} more row${hiddenCount !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

// ─── Media cell renderer ──────────────────────────────────────────────────────
// Renders image fields as thumbnails, file fields as download links,
// and all other fields as plain text.

function MediaCell({ value, fieldType }: { value: unknown; fieldType: string }) {
  const url = typeof value === 'string' && value.startsWith('http') ? value : null;

  if (fieldType === 'image') {
    if (url) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" title="View full image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="attachment"
            className="h-10 w-10 rounded-md object-cover border border-border-color hover:opacity-80 transition-opacity"
            onError={(e) => {
              // If signed URL expired or broken, show a placeholder icon
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute('hidden');
            }}
          />
          <span hidden className="text-[10px] text-text-secondary italic">Image unavailable</span>
        </a>
      );
    }
    return <span className="text-[11px] text-text-secondary italic">No image</span>;
  }

  if (fieldType === 'file') {
    if (url) {
      // Try to extract a readable filename from the URL path
      let fileName = 'Download file';
      try {
        const parts = new URL(url).pathname.split('/');
        const last = parts[parts.length - 1];
        if (last) fileName = decodeURIComponent(last.split('?')[0]);
      } catch {
        /* ignore */
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline text-[11px]"
        >
          📎 {fileName.length > 24 ? `${fileName.slice(0, 22)}…` : fileName}
        </a>
      );
    }
    return <span className="text-[11px] text-text-secondary italic">No file</span>;
  }

  // Default: plain text
  const text = formatCell(value);
  return (
    <span className="truncate block max-w-[220px]" title={text}>
      {text}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
