'use client';

/**
 * DateField — custom single-date picker that DISPLAYS dates as "20 Jul 2026"
 * (day-first) while storing/emitting an ISO "YYYY-MM-DD" string, exactly like a
 * native <input type="date">. Use this instead of native date inputs so the
 * selected/shown value follows the app-wide date-month-year format regardless of
 * the browser's OS locale.
 *
 * The calendar popover renders in a portal with FIXED positioning and an
 * explicit size, so it keeps its shape even inside narrow / horizontally
 * scrolling containers (e.g. datasheet table cells) that would otherwise
 * squeeze or clip it.
 *
 * Drop-in contract:
 *   <input type="date" value={v} onChange={(e) => set(e.target.value)} />
 *   →  <DateField value={v} onChange={(iso) => set(iso)} />
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, toDate, toISODate } from '@/lib/format-date';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Fixed popover box — never squeezed by its container. */
const POPOVER_W = 268;
const POPOVER_H = 320;
const GAP = 6;

export interface DateFieldProps {
  /** ISO date string "YYYY-MM-DD" (or '' / null for empty). */
  value: string | null | undefined;
  /** Emits an ISO "YYYY-MM-DD" string, or '' when cleared. */
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Aligns the popover to the right edge of the trigger. */
  align?: 'left' | 'right';
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}

export function DateField({
  value,
  onChange,
  min,
  max,
  className = '',
  placeholder = 'Select date',
  disabled = false,
  id,
  align = 'left',
}: DateFieldProps) {
  const selected = value ? toDate(value) : null;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  // Month currently shown in the calendar grid.
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setView(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Position the fixed popover relative to the trigger, flipping above when
  // there isn't room below and clamping into the viewport.
  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const openUp = r.bottom + GAP + POPOVER_H > window.innerHeight && r.top - GAP - POPOVER_H > 0;
    let top = openUp ? r.top - GAP - POPOVER_H : r.bottom + GAP;
    let left = align === 'right' ? r.right - POPOVER_W : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - POPOVER_H - 8));
    setPos({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, reposition]);

  // Outside-click closes (trigger and portal popover both count as "inside").
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const minDate = min ? toDate(min) : null;
  const maxDate = max ? toDate(max) : null;

  const days = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = startOfMonth(y, m);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    return cells;
  }, [view]);

  function isDisabled(d: Date): boolean {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    onChange(toISODate(d));
    setOpen(false);
  }

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const triggerCls =
    className ||
    'block w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors';

  const calendar = (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_W, height: POPOVER_H }}
      className="z-[9999] flex flex-col rounded-xl border border-border-color bg-bg-primary p-3 shadow-xl"
    >
      {/* Header: month nav */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
          className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
          className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid flex-1 grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />;
          const disabledDay = isDisabled(d);
          const isSelected = selected && isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={disabledDay}
              onClick={() => pick(d)}
              className={`flex h-8 items-center justify-center rounded-md text-sm transition-colors ${
                isSelected
                  ? 'bg-accent font-semibold text-white'
                  : disabledDay
                    ? 'cursor-not-allowed text-text-secondary/30'
                    : isToday
                      ? 'font-semibold text-accent hover:bg-bg-secondary'
                      : 'text-text-primary hover:bg-bg-secondary'
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer: Today / Clear */}
      <div className="mt-2 flex items-center justify-between border-t border-border-color pt-2">
        <button
          type="button"
          onClick={() => pick(new Date())}
          className="text-xs font-medium text-accent hover:underline"
        >
          Today
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerCls} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-secondary/60'}>
          {selected ? formatDate(selected) : placeholder}
        </span>
        <CalendarDays size={15} className="shrink-0 text-text-secondary" />
      </button>

      {open && mounted && createPortal(calendar, document.body)}
    </>
  );
}
