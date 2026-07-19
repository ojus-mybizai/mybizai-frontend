'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Clock,
  Check,
  X,
  Image as ImageIcon,
  FileText,
  Link2,
  Calculator,
  Phone,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import { HUES, valueColor } from './value-colors';

export type FieldDensity = 'compact' | 'comfortable' | 'detail';

export interface FieldRelationLabel {
  id: number;
  label: string;
}

export interface FieldAttachmentLite {
  id: number;
  signed_url?: string;
  original_file_name?: string;
  mime_type?: string;
}

export interface FieldDisplayEnrichments {
  /** Resolved relation labels for relation-type fields. */
  relationLabels?: FieldRelationLabel[];
  /** Loaded attachments for image/file-type fields. */
  attachments?: FieldAttachmentLite[];
}

export interface FieldDisplayProps {
  field: DynamicField;
  value: unknown;
  /** Visual density. Defaults to 'comfortable'. */
  density?: FieldDensity;
  enrichments?: FieldDisplayEnrichments;
  className?: string;
  /** Render an em-dash for empty values when true. Defaults to true. */
  showEmpty?: boolean;
}

const EMPTY = '—';

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Smart colors                                                       */
/* ────────────────────────────────────────────────────────────────── */

// Boolean yes/no swatches — reuse the shared vocabulary so they match every
// other chip in the app.
const STATUS_GREEN = HUES.green.chip;
const STATUS_GRAY = HUES.slate.chip;

const STATUS_FIELD_RE = /(status|stage|priority|state|phase|level|severity|kind|type)/i;

/**
 * Chip classes for an enum/status value. Delegates to the shared, deterministic
 * {@link valueColor} vocabulary so a value renders the same colour in the table,
 * list, card, kanban and calendar views. A per-option custom colour (rare) still
 * takes precedence.
 */
export function colorForOption(field: DynamicField, value: string): string {
  const userColors = field.config?.option_colors as Record<string, string> | undefined;
  if (userColors && userColors[value]) return userColors[value];
  return valueColor(field, value).chip;
}

/** Smart heuristic: pick the best field to use as a "title" for a record (calendar pills, list items, etc.). */
const TITLE_FIELD_RE = /(name|title|subject|topic|summary|meeting|event|label|heading)/i;
export function pickTitleField(fields: DynamicField[]): DynamicField | null {
  if (!fields.length) return null;
  // 1. Field whose name matches the title regex AND is a text-ish type
  const namedMatch = fields.find((f) =>
    ['text', 'long_text', 'enum'].includes(f.field_type) && (TITLE_FIELD_RE.test(f.name) || TITLE_FIELD_RE.test(f.display_name)),
  );
  if (namedMatch) return namedMatch;
  // 2. First text field
  const firstText = fields.find((f) => f.field_type === 'text');
  if (firstText) return firstText;
  // 3. First long_text
  const firstLong = fields.find((f) => f.field_type === 'long_text');
  if (firstLong) return firstLong;
  // 4. First enum
  const firstEnum = fields.find((f) => f.field_type === 'enum');
  if (firstEnum) return firstEnum;
  // 5. First non-attachment, non-relation, non-computed field
  return fields.find((f) => !['image', 'file', 'relation', 'computed'].includes(f.field_type)) ?? null;
}

/** Pick the best status-like field to use as a secondary chip on cards/pills. */
export function pickSecondaryField(fields: DynamicField[], excludeName?: string | null): DynamicField | null {
  const enums = fields.filter((f) => f.field_type === 'enum' && f.name !== excludeName);
  if (!enums.length) return null;
  // Prefer status-named enums
  const statusEnum = enums.find((f) => STATUS_FIELD_RE.test(f.name) || STATUS_FIELD_RE.test(f.display_name));
  return statusEnum ?? enums[0];
}

/* ────────────────────────────────────────────────────────────────── */
/*  Formatters                                                         */
/* ────────────────────────────────────────────────────────────────── */

function formatNumber(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value);
}

function formatCurrency(value: unknown, code: string): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown, density: FieldDensity): { primary: string; tooltip: string } | null {
  const d = parseDate(value);
  if (!d) return null;
  const primary = density === 'detail'
    ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return { primary, tooltip: d.toString() };
}

function formatTime(value: unknown, field: DynamicField): string {
  if (typeof value !== 'string' || !value) return String(value ?? '');
  const m = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return value;
  const h = Number(m[1]);
  const min = m[2];
  const fmt = (field.config?.format as string) ?? '24h';
  if (fmt === '12h') {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${min} ${period}`;
  }
  return `${String(h).padStart(2, '0')}:${min}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Reusable atoms                                                     */
/* ────────────────────────────────────────────────────────────────── */

function EmptyDash({ density }: { density: FieldDensity }) {
  return (
    <span className={`text-text-muted ${density === 'detail' ? 'text-sm' : 'text-xs'}`}>{EMPTY}</span>
  );
}

function Chip({
  children,
  colorClass,
  density,
  title,
}: {
  children: React.ReactNode;
  colorClass: string;
  density: FieldDensity;
  title?: string;
}) {
  const sizing = density === 'compact'
    ? 'px-1.5 py-0 text-[10px]'
    : density === 'detail'
      ? 'px-2.5 py-0.5 text-xs'
      : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full font-medium ring-1 ring-inset ${sizing} ${colorClass}`}
    >
      {children}
    </span>
  );
}

function AvatarInitial({ label, size = 'sm' }: { label: string; size?: 'xs' | 'sm' | 'md' }) {
  const dim = size === 'xs' ? 'h-3.5 w-3.5 text-[8px]' : size === 'md' ? 'h-6 w-6 text-[11px]' : 'h-4 w-4 text-[9px]';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-white font-bold ${dim}`}>
      {(label.charAt(0) || '?').toUpperCase()}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Renderer                                                           */
/* ────────────────────────────────────────────────────────────────── */

export function FieldDisplay({
  field,
  value,
  density = 'comfortable',
  enrichments,
  className,
  showEmpty = true,
}: FieldDisplayProps) {
  const router = useRouter();
  const ft = field.field_type;

  // Empty handling
  if (isEmpty(value) && ft !== 'image' && ft !== 'file' && ft !== 'computed') {
    return showEmpty ? <EmptyDash density={density} /> : null;
  }

  const containerCls = className ?? '';

  // ── Boolean ──
  if (ft === 'boolean') {
    const truthy = value === true || value === 'true' || value === 1 || value === '1';
    const cls = truthy ? STATUS_GREEN : STATUS_GRAY;
    return (
      <Chip colorClass={cls} density={density}>
        {truthy ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
        <span>{truthy ? 'Yes' : 'No'}</span>
      </Chip>
    );
  }

  // ── Currency ──
  if (ft === 'currency') {
    const code = (field.config?.currency_code as string) || 'USD';
    const text = formatCurrency(value, code);
    return (
      <span className={`whitespace-nowrap font-medium text-text-primary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
        {text}
      </span>
    );
  }

  // ── Number ──
  if (ft === 'number') {
    return (
      <span className={`whitespace-nowrap font-mono text-text-primary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
        {formatNumber(value)}
      </span>
    );
  }

  // ── Date ──
  if (ft === 'date') {
    const formatted = formatDate(value, density);
    if (!formatted) return <EmptyDash density={density} />;
    return (
      <span
        title={formatted.tooltip}
        className={`inline-flex items-center gap-1 text-text-primary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}
      >
        {density !== 'compact' && <CalendarIcon className="h-3.5 w-3.5 text-text-secondary" />}
        <span>{formatted.primary}</span>
      </span>
    );
  }

  // ── Time ──
  if (ft === 'time') {
    return (
      <span className={`inline-flex items-center gap-1 text-text-primary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
        {density !== 'compact' && <Clock className="h-3.5 w-3.5 text-text-secondary" />}
        <span>{formatTime(value, field)}</span>
      </span>
    );
  }

  // ── Phone ──
  if (ft === 'phone') {
    const raw = String(value ?? '').trim();
    if (!raw) return <EmptyDash density={density} />;
    return (
      <a
        href={`tel:${raw.replace(/[^\d+]/g, '')}`}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 text-text-primary hover:text-accent ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}
      >
        {density !== 'compact' && <Phone className="h-3.5 w-3.5 text-text-secondary" />}
        <span className="truncate">{raw}</span>
      </a>
    );
  }

  // ── Enum (status-aware badge) ──
  if (ft === 'enum') {
    const s = String(value);
    return <Chip colorClass={colorForOption(field, s)} density={density} title={s}>{truncate(s, density === 'detail' ? 60 : 24)}</Chip>;
  }

  // ── Multi-select (chips) ──
  if (ft === 'multi_select') {
    const items: string[] = Array.isArray(value)
      ? (value as unknown[]).map(String)
      : String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (!items.length) return <EmptyDash density={density} />;
    const maxVisible = density === 'compact' ? 2 : density === 'detail' ? 12 : 3;
    const shown = items.slice(0, maxVisible);
    const overflow = items.length - shown.length;
    return (
      <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${containerCls}`}>
        {shown.map((v, i) => (
          <Chip key={`${v}-${i}`} colorClass={colorForOption(field, v)} density={density} title={v}>
            {truncate(v, density === 'detail' ? 30 : 16)}
          </Chip>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] font-medium text-text-secondary" title={items.slice(maxVisible).join(', ')}>
            +{overflow}
          </span>
        )}
      </span>
    );
  }

  // ── Relation ──
  if (ft === 'relation') {
    const ids: number[] = Array.isArray(value)
      ? (value as unknown[]).map(Number).filter(Number.isFinite)
      : Number.isFinite(Number(value))
        ? [Number(value)]
        : [];
    if (!ids.length) return <EmptyDash density={density} />;

    const labels = enrichments?.relationLabels ?? [];
    const resolved = ids.map((id) => labels.find((l) => l.id === id)?.label ?? `#${id}`);

    if (!labels.length) {
      // No labels resolved — show count placeholder
      return (
        <span className={`inline-flex items-center gap-1 text-text-secondary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
          <Link2 className="h-3.5 w-3.5" />
          {ids.length} linked
        </span>
      );
    }

    const maxVisible = density === 'compact' ? 1 : density === 'detail' ? 20 : 2;
    const shownIds = ids.slice(0, maxVisible);
    const overflow = resolved.length - shownIds.length;
    const ringCls = 'bg-accent/10 text-accent ring-accent/20 dark:bg-accent/20 dark:text-accent';
    // Custom-model relations have a record page; builtin ones (contacts/users/
    // work) do not, so only the former become clickable "open record" chips.
    const canRoute = !!field.relation_model_id && !field.relation_builtin_model;

    return (
      <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${containerCls}`}>
        {shownIds.map((id, i) => {
          const label = resolved[i];
          const chip = (
            <Chip colorClass={ringCls} density={density} title={canRoute ? `Open ${label}` : label}>
              <AvatarInitial label={label} size={density === 'detail' ? 'sm' : 'xs'} />
              <span className="truncate">{truncate(label, density === 'detail' ? 40 : 18)}</span>
              {canRoute && (
                <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/relchip:opacity-100" />
              )}
            </Chip>
          );
          if (!canRoute) return <React.Fragment key={i}>{chip}</React.Fragment>;
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/data-sheet/${field.relation_model_id}/${id}`);
              }}
              className="group/relchip inline-flex max-w-full items-center rounded-full transition hover:brightness-105"
            >
              {chip}
            </button>
          );
        })}
        {overflow > 0 && (
          <span className="text-[10px] font-medium text-text-secondary" title={resolved.slice(maxVisible).join(', ')}>
            +{overflow}
          </span>
        )}
      </span>
    );
  }

  // ── Image ──
  if (ft === 'image') {
    const atts = enrichments?.attachments ?? [];
    const visualAtts = atts.filter((a) => a.signed_url);
    if (!visualAtts.length) {
      return (
        <span className={`inline-flex items-center gap-1 text-text-secondary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
          <ImageIcon className="h-3.5 w-3.5" />
          {density !== 'compact' && <span>No image</span>}
        </span>
      );
    }
    const max = density === 'compact' ? 1 : density === 'detail' ? 8 : 3;
    const shown = visualAtts.slice(0, max);
    const overflow = visualAtts.length - shown.length;
    const size = density === 'compact' ? 'h-6 w-6' : density === 'detail' ? 'h-20 w-20' : 'h-10 w-10';
    return (
      <span className={`inline-flex items-center gap-1 ${containerCls}`}>
        {shown.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.id}
            src={a.signed_url}
            alt={a.original_file_name ?? ''}
            className={`${size} shrink-0 rounded border border-border-color object-cover`}
            loading="lazy"
          />
        ))}
        {overflow > 0 && (
          <span className={`inline-flex shrink-0 items-center justify-center rounded border border-border-color bg-bg-secondary text-text-secondary ${size} text-xs font-medium`}>
            +{overflow}
          </span>
        )}
      </span>
    );
  }

  // ── File ──
  if (ft === 'file') {
    const atts = enrichments?.attachments ?? [];
    if (!atts.length) {
      return (
        <span className={`inline-flex items-center gap-1 text-text-secondary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
          <FileText className="h-3.5 w-3.5" />
          {density !== 'compact' && <span>No file</span>}
        </span>
      );
    }
    const max = density === 'compact' ? 1 : density === 'detail' ? 10 : 2;
    const shown = atts.slice(0, max);
    const overflow = atts.length - shown.length;
    return (
      <span className={`inline-flex max-w-full flex-wrap items-center gap-1 ${containerCls}`}>
        {shown.map((a) => (
          <a
            key={a.id}
            href={a.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-primary hover:bg-accent/10 hover:text-accent transition-colors`}
            title={a.original_file_name}
          >
            <FileText className="h-3 w-3 text-text-secondary" />
            <span className="max-w-[140px] truncate">{a.original_file_name ?? `File ${a.id}`}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
          </a>
        ))}
        {overflow > 0 && <span className="text-[10px] font-medium text-text-secondary">+{overflow}</span>}
      </span>
    );
  }

  // ── Computed ──
  if (ft === 'computed') {
    const text = isEmpty(value) ? EMPTY : String(value);
    return (
      <span className={`inline-flex items-center gap-1 ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`}>
        <Calculator className="h-3 w-3 text-blue-500" />
        <span className="text-text-primary">{text}</span>
      </span>
    );
  }

  // ── Long text ──
  if (ft === 'long_text') {
    const s = String(value);
    if (density === 'detail') {
      return <p className={`whitespace-pre-wrap text-sm text-text-primary ${containerCls}`}>{s}</p>;
    }
    const max = density === 'compact' ? 60 : 100;
    return (
      <span className={`text-sm text-text-primary line-clamp-2 ${containerCls}`} title={s}>
        {truncate(s, max)}
      </span>
    );
  }

  // ── Text (default) ──
  const s = String(value);
  const max = density === 'compact' ? 60 : density === 'detail' ? 999 : 120;
  return (
    <span className={`text-text-primary ${density === 'compact' ? 'text-xs' : 'text-sm'} ${containerCls}`} title={s.length > max ? s : undefined}>
      {truncate(s, max)}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/*  Label + value combo (for cards / list rows)                        */
/* ────────────────────────────────────────────────────────────────── */

export interface FieldLabelValueProps extends FieldDisplayProps {
  /** Layout: stacked (label above) or inline (label : value) */
  layout?: 'stacked' | 'inline';
}

export function FieldLabelValue({ field, value, density = 'comfortable', layout = 'inline', enrichments, className }: FieldLabelValueProps) {
  const labelEl = (
    <span className={`shrink-0 ${density === 'detail' ? 'text-[11px] font-semibold uppercase tracking-wider text-text-muted' : 'text-xs font-medium text-text-secondary'}`}>
      {field.display_name}
    </span>
  );

  if (layout === 'stacked') {
    return (
      <div className={`min-w-0 ${className ?? ''}`}>
        {labelEl}
        <div className="mt-0.5 min-w-0">
          <FieldDisplay field={field} value={value} density={density} enrichments={enrichments} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-2 ${className ?? ''}`}>
      {labelEl}
      <span className="min-w-0 truncate text-right">
        <FieldDisplay field={field} value={value} density={density} enrichments={enrichments} />
      </span>
    </div>
  );
}
