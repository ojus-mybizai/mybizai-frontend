'use client';

import React, { useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Work } from '@/services/work';
import { priorityDotColor } from './work-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkCalendarViewProps {
  items: Work[];
  onItemClick: (workId: number) => void;
  onMonthChange: (year: number, month: number) => void;
  currentYear: number;
  currentMonth: number; // 0-indexed
}

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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function priorityBorderClass(p: string): string {
  switch (p) {
    case 'high': return 'border-red-500 dark:border-red-400';
    case 'medium': return 'border-amber-500 dark:border-amber-400';
    default: return 'border-slate-300 dark:border-slate-600';
  }
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
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      inCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inCurrentMonth: true });
  }

  // Next month padding to fill complete weeks
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        date: new Date(year, month + 1, d),
        inCurrentMonth: false,
      });
    }
  }

  return cells;
}

/* ------------------------------------------------------------------ */
/*  Work pill                                                          */
/* ------------------------------------------------------------------ */

function WorkPill({
  work,
  compact,
  onClick,
}: {
  work: Work;
  compact: boolean;
  onClick: (workId: number) => void;
}) {
  const title = work.title || 'Untitled';

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(work.id);
        }}
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${priorityDotColor(work.priority)}`}
        title={title}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(work.id);
      }}
      className={`w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight
        text-text-primary bg-card-bg hover:bg-bg-primary transition-colors
        ${priorityBorderClass(work.priority)}`}
      title={title}
    >
      {title.length > 15 ? `${title.slice(0, 15)}...` : title}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Day Cell                                                           */
/* ------------------------------------------------------------------ */

function DayCell({
  cell,
  workItems,
  isToday,
  onItemClick,
}: {
  cell: CalendarCell;
  workItems: Work[];
  isToday: boolean;
  onItemClick: (workId: number) => void;
}) {
  const visible = workItems.slice(0, MAX_PILLS);
  const overflow = workItems.length - MAX_PILLS;

  return (
    <div
      className={`relative flex flex-col border border-border-color
        min-h-[60px] md:min-h-[100px] p-1
        ${cell.inCurrentMonth ? 'bg-card-bg' : 'bg-bg-secondary/50 opacity-50'}
        ${isToday ? 'ring-2 ring-accent ring-inset' : ''}`}
    >
      {/* Day number */}
      <span
        className={`mb-0.5 text-xs font-medium
          ${isToday ? 'text-accent font-bold' : 'text-text-secondary'}`}
      >
        {cell.date.getDate()}
      </span>

      {/* Desktop: pills with text */}
      <div className="hidden flex-col gap-0.5 sm:flex">
        {visible.map((w) => (
          <WorkPill key={w.id} work={w} compact={false} onClick={onItemClick} />
        ))}
        {overflow > 0 && (
          <span className="mt-0.5 text-[10px] font-medium text-accent cursor-default">
            +{overflow} more
          </span>
        )}
      </div>

      {/* Mobile: dots only */}
      <div className="flex flex-wrap gap-0.5 sm:hidden">
        {visible.map((w) => (
          <WorkPill key={w.id} work={w} compact onClick={onItemClick} />
        ))}
        {overflow > 0 && (
          <span className="text-[9px] text-accent">+{overflow}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar View                                                      */
/* ------------------------------------------------------------------ */

export default function WorkCalendarView({
  items,
  onItemClick,
  onMonthChange,
  currentYear,
  currentMonth,
}: WorkCalendarViewProps) {
  /* Build the grid of day cells */
  const cells = useMemo(
    () => buildCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth],
  );

  /* Index work items by date string for fast lookup */
  const workByDate = useMemo(() => {
    const map = new Map<string, Work[]>();
    for (const w of items) {
      if (!w.due_date) continue;
      const key = w.due_date.slice(0, 10); // YYYY-MM-DD
      const list = map.get(key);
      if (list) {
        list.push(w);
      } else {
        map.set(key, [w]);
      }
    }
    return map;
  }, [items]);

  const today = useMemo(() => new Date(), []);

  /* Navigation */
  const goToPrev = useCallback(() => {
    const prev = new Date(currentYear, currentMonth - 1, 1);
    onMonthChange(prev.getFullYear(), prev.getMonth());
  }, [currentYear, currentMonth, onMonthChange]);

  const goToNext = useCallback(() => {
    const next = new Date(currentYear, currentMonth + 1, 1);
    onMonthChange(next.getFullYear(), next.getMonth());
  }, [currentYear, currentMonth, onMonthChange]);

  const goToToday = useCallback(() => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth());
  }, [onMonthChange]);

  /* Helpers */
  function dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Navigation bar */}
      <div className="flex items-center justify-between rounded-lg bg-bg-secondary px-4 py-2">
        <button
          type="button"
          onClick={goToPrev}
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary md:text-base">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-border-color px-2.5 py-1 text-xs font-medium
              text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors"
          >
            Today
          </button>
        </div>

        <button
          type="button"
          onClick={goToNext}
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="border border-border-color bg-bg-secondary px-2 py-1.5 text-center text-xs font-semibold text-text-secondary"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const key = dateKey(cell.date);
          const workItems = workByDate.get(key) ?? [];
          const cellIsToday = isSameDay(cell.date, today);

          return (
            <DayCell
              key={key}
              cell={cell}
              workItems={workItems}
              isToday={cellIsToday}
              onItemClick={onItemClick}
            />
          );
        })}
      </div>
    </div>
  );
}
