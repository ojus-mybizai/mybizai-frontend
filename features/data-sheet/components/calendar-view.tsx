'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import type { QueryResponse } from '@/features/data-sheet/api';
import type { CalendarViewConfig } from '@/features/data-sheet/state/view-state';

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

const PILL_COLORS = [
  'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  'border-green-500 bg-green-50 dark:bg-green-900/20',
  'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
  'border-rose-500 bg-rose-50 dark:bg-rose-900/20',
  'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20',
];

function getPillColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
}

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

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inCurrentMonth: true });
  }

  // Next month padding
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
  record,
  pillFields,
  fields,
  compact,
  onClick,
}: {
  record: RecordItem;
  pillFields: string[];
  fields: DynamicField[];
  compact: boolean;
  onClick: (row: RecordItem) => void;
}) {
  const label: string = (() => {
    const data = (record.data ?? {}) as Record<string, unknown>;
    for (const fn of pillFields) {
      const val = data[fn];
      if (val !== null && val !== undefined && val !== '') return String(val);
    }
    for (const f of fields) {
      if (['text', 'enum'].includes(f.field_type)) {
        const val = data[f.name];
        if (val) return String(val);
      }
    }
    return String(record.record_key || `#${record.id}`);
  })();

  const colorClass = getPillColor(String(label));

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(record); }}
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass.split(' ')[0]?.replace('border-', 'bg-') || 'bg-accent'}`}
        title={label}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(record); }}
      className={`w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight
        text-text-primary hover:brightness-95 transition-colors ${colorClass}`}
      title={label}
    >
      {label.length > 18 ? `${label.slice(0, 18)}...` : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Day Cell                                                           */
/* ------------------------------------------------------------------ */

function DayCell({
  cell,
  records,
  pillFields,
  fields,
  isToday,
  onRecordClick,
}: {
  cell: CalendarCell;
  records: RecordItem[];
  pillFields: string[];
  fields: DynamicField[];
  isToday: boolean;
  onRecordClick: (row: RecordItem) => void;
}) {
  const visible = records.slice(0, MAX_PILLS);
  const overflow = records.length - MAX_PILLS;

  return (
    <div
      className={`relative flex flex-col border border-border-color min-h-[60px] md:min-h-[100px] p-1
        ${cell.inCurrentMonth ? 'bg-card-bg' : 'bg-bg-secondary/50 opacity-50'}
        ${isToday ? 'ring-2 ring-accent ring-inset' : ''}`}
    >
      <span className={`mb-0.5 text-xs font-medium ${isToday ? 'text-accent font-bold' : 'text-text-secondary'}`}>
        {cell.date.getDate()}
      </span>

      {/* Desktop: pills */}
      <div className="hidden flex-col gap-0.5 sm:flex">
        {visible.map((r) => (
          <RecordPill key={String(r.id)} record={r} pillFields={pillFields} fields={fields} compact={false} onClick={onRecordClick} />
        ))}
        {overflow > 0 && (
          <span className="mt-0.5 text-[10px] font-medium text-accent cursor-default">+{overflow} more</span>
        )}
      </div>

      {/* Mobile: dots */}
      <div className="flex flex-wrap gap-0.5 sm:hidden">
        {visible.map((r) => (
          <RecordPill key={String(r.id)} record={r} pillFields={pillFields} fields={fields} compact onClick={onRecordClick} />
        ))}
        {overflow > 0 && <span className="text-[9px] text-accent">+{overflow}</span>}
      </div>
    </div>
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

  const dateFields = useMemo(() => fields.filter((f) => f.field_type === 'date'), [fields]);

  const pillFields = useMemo(() => {
    if (config.pillFields && config.pillFields.length > 0) return config.pillFields;
    // Default: first 2 text/enum fields
    return fields
      .filter((f) => ['text', 'enum'].includes(f.field_type))
      .slice(0, 2)
      .map((f) => f.name);
  }, [config.pillFields, fields]);

  // Build calendar grid
  const cells = useMemo(() => buildCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Index records by date
  const recordsByDate = useMemo(() => {
    if (!config.dateField) return new Map<string, RecordItem[]>();
    const map = new Map<string, RecordItem[]>();
    for (const item of items) {
      const val = ((item.data ?? {}) as Record<string, unknown>)[config.dateField];
      if (!val) continue;
      const key = String(val).slice(0, 10); // YYYY-MM-DD
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items, config.dateField]);

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

  const handleRecordClick = useCallback(
    (record: RecordItem) => {
      onViewDetail({ id: Number(record.id), data: (record.data ?? {}) as Record<string, unknown>, recordKey: String(record.record_key ?? '') });
    },
    [onViewDetail],
  );

  /* ── No date field selected ── */
  if (!config.dateField) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CalendarDays className="h-12 w-12 text-text-secondary" />
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary mb-1">Select a date field</p>
          <p className="text-xs text-text-secondary mb-4">Choose which date field to use for placing records on the calendar</p>
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

  return (
    <div className="flex flex-col gap-2">
      {/* Navigation bar */}
      <div className="flex items-center justify-between rounded-lg bg-bg-secondary px-4 py-2">
        <button type="button" onClick={goToPrev} className="rounded-md p-1.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors" aria-label="Previous month">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary md:text-base">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button type="button" onClick={goToToday} className="rounded-md border border-border-color px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors">
            Today
          </button>
          {/* Date field selector */}
          <select
            className="rounded-md border border-border-color bg-transparent px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
            value={config.dateField}
            onChange={(e) => onConfigChange({ ...config, dateField: e.target.value || null })}
          >
            {dateFields.map((f) => (
              <option key={f.name} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={goToNext} className="rounded-md p-1.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors" aria-label="Next month">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAY_NAMES.map((day) => (
          <div key={day} className="border border-border-color bg-bg-secondary px-2 py-1.5 text-center text-xs font-semibold text-text-secondary">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const key = dateKey(cell.date);
          const records = recordsByDate.get(key) ?? [];
          const cellIsToday = isSameDay(cell.date, today);
          return (
            <DayCell
              key={key}
              cell={cell}
              records={records}
              pillFields={pillFields}
              fields={fields}
              isToday={cellIsToday}
              onRecordClick={handleRecordClick}
            />
          );
        })}
      </div>
    </div>
  );
}
