'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import type { QueryResponse } from '@/features/data-sheet/api';
import type { CalendarViewConfig } from '@/features/data-sheet/state/view-state';
import { pickTitleField, pickSecondaryField } from '@/components/data-sheet/field-display';
import { valueColor, type ValueColor } from '@/components/data-sheet/value-colors';

type RecordItem = QueryResponse['items'][number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MAX_PILLS = 3;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/*  Record → title / secondary / colour                                */
/* ------------------------------------------------------------------ */

interface ResolvedRecord {
  title: string;
  secondary: string;
  color: ValueColor;
}

function resolveRecord(
  record: RecordItem,
  titleField: DynamicField | null,
  secondaryField: DynamicField | null,
  fields: DynamicField[],
): ResolvedRecord {
  const data = (record.data ?? {}) as Record<string, unknown>;

  let title = '';
  if (titleField) {
    const v = data[titleField.name];
    if (v !== null && v !== undefined && v !== '') title = String(v);
  }
  if (!title) {
    for (const f of fields) {
      if (['text', 'long_text', 'enum'].includes(f.field_type)) {
        const val = data[f.name];
        if (val !== null && val !== undefined && val !== '') { title = String(val); break; }
      }
    }
  }
  if (!title) title = String(record.record_key || `#${record.id}`);

  const secVal = secondaryField ? data[secondaryField.name] : null;
  const secondary = secVal !== null && secVal !== undefined && secVal !== '' ? String(secVal) : '';

  // Colour: from the secondary enum value when present (so status drives it and
  // matches the kanban/pills), else a stable hash of the title.
  const color = secondary && secondaryField?.field_type === 'enum'
    ? valueColor(secondaryField, secondary)
    : valueColor(null, title);

  return { title, secondary, color };
}

/* ------------------------------------------------------------------ */
/*  Calendar grid builder                                              */
/* ------------------------------------------------------------------ */

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
}

function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inCurrentMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), inCurrentMonth: false });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/*  Record Pill                                                        */
/* ------------------------------------------------------------------ */

function RecordPill({
  resolved,
  compact,
  onClick,
}: {
  resolved: ResolvedRecord;
  compact: boolean;
  onClick: () => void;
}) {
  const { title, secondary, color } = resolved;

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${color.dot}`}
        title={`${title}${secondary ? ` · ${secondary}` : ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`group flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-left leading-tight
        transition-colors hover:brightness-[0.97] ${color.softBg}`}
      title={`${title}${secondary ? ` · ${secondary}` : ''}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`} aria-hidden />
      <span className={`truncate text-[11px] font-medium ${color.text}`}>{title}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Day Cell                                                           */
/* ------------------------------------------------------------------ */

function DayCell({
  cell,
  resolvedRecords,
  isToday,
  onRecordClick,
  onOverflowClick,
}: {
  cell: CalendarCell;
  resolvedRecords: ResolvedRecord[];
  isToday: boolean;
  onRecordClick: (idx: number) => void;
  onOverflowClick: () => void;
}) {
  const visible = resolvedRecords.slice(0, MAX_PILLS);
  const overflow = resolvedRecords.length - MAX_PILLS;

  return (
    <div
      className={`relative flex min-h-[68px] flex-col p-1.5 md:min-h-[116px]
        ${cell.inCurrentMonth ? 'bg-card-bg' : 'bg-bg-secondary/40 text-text-secondary/60'}
        ${isToday ? 'bg-accent/[0.06]' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold
            ${isToday ? 'bg-accent text-white' : cell.inCurrentMonth ? 'text-text-primary' : 'text-text-secondary/60'}`}
        >
          {cell.date.getDate()}
        </span>
      </div>

      {/* Desktop: pills */}
      <div className="hidden flex-col gap-1 sm:flex">
        {visible.map((r, i) => (
          <RecordPill key={i} resolved={r} compact={false} onClick={() => onRecordClick(i)} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOverflowClick(); }}
            className="mt-0.5 rounded px-1 text-left text-[10px] font-semibold text-accent hover:bg-accent/10"
          >
            +{overflow} more
          </button>
        )}
      </div>

      {/* Mobile: dots */}
      <div className="flex flex-wrap gap-1 sm:hidden">
        {visible.map((r, i) => (
          <RecordPill key={i} resolved={r} compact onClick={() => onRecordClick(i)} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOverflowClick(); }}
            className="text-[9px] font-semibold text-accent"
          >
            +{overflow}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Day detail popover (for "+N more")                                 */
/* ------------------------------------------------------------------ */

function DayDetailModal({
  date,
  resolvedRecords,
  onClose,
  onRecordClick,
}: {
  date: Date;
  resolvedRecords: ResolvedRecord[];
  onClose: () => void;
  onRecordClick: (idx: number) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-color bg-card-bg p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {resolvedRecords.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onRecordClick(i)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:border-accent/40 ${r.color.soft}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.color.dot}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">{r.title}</span>
                {r.secondary && <span className={`block truncate text-xs font-medium ${r.color.text}`}>{r.secondary}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar View                                                      */
/* ------------------------------------------------------------------ */

interface CalendarViewProps {
  items: RecordItem[];
  fields: DynamicField[];
  config: CalendarViewConfig;
  onViewDetail: (row: { id: number; data: Record<string, unknown>; recordKey: string }) => void;
  onConfigChange: (config: CalendarViewConfig) => void;
}

export default function CalendarView({
  items,
  fields,
  config,
  onViewDetail,
  onConfigChange,
}: CalendarViewProps) {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [detailDay, setDetailDay] = useState<string | null>(null);

  const dateFields = useMemo(() => fields.filter((f) => f.field_type === 'date'), [fields]);

  const titleField: DynamicField | null = useMemo(() => {
    if (config.titleField) return fields.find((f) => f.name === config.titleField) ?? null;
    const legacyFirst = config.pillFields?.[0];
    if (legacyFirst) {
      const f = fields.find((ff) => ff.name === legacyFirst);
      if (f) return f;
    }
    return pickTitleField(fields);
  }, [config.titleField, config.pillFields, fields]);

  const secondaryField: DynamicField | null = useMemo(() => {
    if (config.secondaryField) return fields.find((f) => f.name === config.secondaryField) ?? null;
    return pickSecondaryField(fields, titleField?.name ?? null);
  }, [config.secondaryField, fields, titleField]);

  const cells = useMemo(() => buildCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Index resolved records by date key.
  const recordsByDate = useMemo(() => {
    const map = new Map<string, { record: RecordItem; resolved: ResolvedRecord }[]>();
    if (!config.dateField) return map;
    for (const item of items) {
      const val = ((item.data ?? {}) as Record<string, unknown>)[config.dateField];
      if (!val) continue;
      const key = String(val).slice(0, 10);
      const entry = { record: item, resolved: resolveRecord(item, titleField, secondaryField, fields) };
      const list = map.get(key);
      if (list) list.push(entry); else map.set(key, [entry]);
    }
    return map;
  }, [items, config.dateField, titleField, secondaryField, fields]);

  const today = useMemo(() => new Date(), []);

  const goToPrev = useCallback(() => {
    const prev = new Date(currentYear, currentMonth - 1, 1);
    setCurrentYear(prev.getFullYear());
    setCurrentMonth(prev.getMonth());
  }, [currentYear, currentMonth]);

  const goToNext = useCallback(() => {
    const next = new Date(currentYear, currentMonth + 1, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
  }, [currentYear, currentMonth]);

  const goToToday = useCallback(() => {
    const n = new Date();
    setCurrentYear(n.getFullYear());
    setCurrentMonth(n.getMonth());
  }, []);

  const openRecord = useCallback(
    (record: RecordItem) => {
      onViewDetail({ id: Number(record.id), data: (record.data ?? {}) as Record<string, unknown>, recordKey: String(record.record_key ?? '') });
    },
    [onViewDetail],
  );

  /* ── No date field selected ── */
  if (!config.dateField) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-color bg-card-bg/50 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary text-text-secondary">
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="mb-1 text-sm font-semibold text-text-primary">Place records on a calendar</p>
          <p className="mb-4 text-xs text-text-secondary">Choose which date field positions each record</p>
        </div>
        {dateFields.length === 0 ? (
          <p className="text-xs text-text-secondary">No date fields found in this datasheet</p>
        ) : (
          <select
            className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            value=""
            onChange={(e) => onConfigChange({ ...config, dateField: e.target.value || null })}
          >
            <option value="">Choose a date field...</option>
            {dateFields.map((f) => (
              <option key={f.name} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const detailEntries = detailDay ? (recordsByDate.get(detailDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation bar */}
      <div className="flex items-center justify-between rounded-2xl border border-border-color bg-card-bg px-3 py-2">
        <button type="button" onClick={goToPrev} className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary" aria-label="Previous month">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-sm font-semibold text-text-primary md:text-base">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button type="button" onClick={goToToday} className="rounded-lg border border-border-color px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary">
            Today
          </button>
          <select
            className="rounded-lg border border-border-color bg-transparent px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent"
            value={config.dateField}
            onChange={(e) => onConfigChange({ ...config, dateField: e.target.value || null })}
          >
            {dateFields.map((f) => (
              <option key={f.name} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={goToNext} className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary" aria-label="Next month">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Grid — gap-px over a border-coloured surface draws crisp 1px gridlines */}
      <div className="overflow-hidden rounded-2xl border border-border-color">
        <div className="grid grid-cols-7 gap-px bg-border-color">
          {/* Day headers */}
          {DAY_NAMES.map((day) => (
            <div key={day} className="bg-bg-secondary px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}

          {/* Day cells */}
          {cells.map((cell) => {
            const key = dateKey(cell.date);
            const entries = recordsByDate.get(key) ?? [];
            return (
              <DayCell
                key={key}
                cell={cell}
                resolvedRecords={entries.map((e) => e.resolved)}
                isToday={isSameDay(cell.date, today)}
                onRecordClick={(idx) => entries[idx] && openRecord(entries[idx].record)}
                onOverflowClick={() => setDetailDay(key)}
              />
            );
          })}
        </div>
      </div>

      {detailDay && (
        <DayDetailModal
          date={(() => { const [y, m, d] = detailDay.split('-').map(Number); return new Date(y, m - 1, d); })()}
          resolvedRecords={detailEntries.map((e) => e.resolved)}
          onClose={() => setDetailDay(null)}
          onRecordClick={(idx) => {
            if (detailEntries[idx]) { openRecord(detailEntries[idx].record); setDetailDay(null); }
          }}
        />
      )}
    </div>
  );
}
