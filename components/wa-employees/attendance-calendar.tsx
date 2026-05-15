'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AttendanceRecord } from '@/services/waEmployees';

interface Props {
  /** First day of the month to display */
  month: Date;
  /** Attendance records keyed by YYYY-MM-DD */
  records: Map<string, AttendanceRecord[]>;
  selectedDate: string | null;
  activeEmployeeCount: number;
  onDaySelect: (date: string) => void;
  onMonthChange: (month: Date) => void;
  loading?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cellColor(pct: number): string {
  if (pct <= 0)  return '';
  if (pct < 0.5) return 'bg-green-100 dark:bg-green-900/30';
  if (pct < 0.8) return 'bg-green-300 dark:bg-green-700/60';
  return 'bg-green-500 dark:bg-green-600';
}

function cellTextColor(pct: number): string {
  if (pct >= 0.8) return 'text-white';
  return '';
}

export function AttendanceCalendar({
  month,
  records,
  selectedDate,
  activeEmployeeCount,
  onDaySelect,
  onMonthChange,
  loading,
}: Props) {
  const todayKey = toDateKey(new Date());

  const { days, startOffset, totalCells } = useMemo(() => {
    const year = month.getFullYear();
    const mon  = month.getMonth();
    const firstDay = new Date(year, mon, 1);
    const lastDate = new Date(year, mon + 1, 0).getDate();
    const start = firstDay.getDay(); // 0 = Sunday
    const days: Date[] = [];
    for (let d = 1; d <= lastDate; d++) days.push(new Date(year, mon, d));
    return { days, startOffset: start, totalCells: start + lastDate };
  }, [month]);

  const trailingCells = Math.ceil(totalCells / 7) * 7 - totalCells;

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function prevMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }
  function nextMonth() {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  return (
    <div className="bg-bg-primary border border-border-color rounded-xl overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-text-primary">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-bg-secondary border-b border-border-color">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-text-secondary py-2 select-none">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className={`grid grid-cols-7 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Leading empty cells */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div
            key={`lead-${i}`}
            className="h-14 border-b border-border-color border-r last:border-r-0"
          />
        ))}

        {days.map((day, idx) => {
          const key       = toDateKey(day);
          const recs      = records.get(key) ?? [];
          const checkedIn = recs.filter((r) => r.check_in_at).length;
          const total     = activeEmployeeCount > 0 ? activeEmployeeCount : (recs.length || 1);
          const pct       = recs.length > 0 ? checkedIn / total : 0;
          const isToday   = key === todayKey;
          const isSel     = key === selectedDate;
          const col       = (startOffset + idx) % 7;
          const isLastCol = col === 6;
          const bgCls     = recs.length > 0 ? cellColor(pct) : '';
          const txtCls    = recs.length > 0 ? cellTextColor(pct) : '';

          return (
            <button
              key={key}
              onClick={() => onDaySelect(key)}
              title={recs.length > 0 ? `${checkedIn} / ${activeEmployeeCount || recs.length} checked in` : 'No data'}
              className={[
                'h-14 flex flex-col items-center justify-center gap-0.5',
                'border-b border-border-color transition-all select-none',
                isLastCol ? '' : 'border-r',
                bgCls,
                txtCls,
                isSel
                  ? 'ring-2 ring-inset ring-accent'
                  : 'hover:ring-2 hover:ring-inset hover:ring-accent/30',
                recs.length === 0 ? 'hover:bg-bg-secondary' : '',
              ].join(' ')}
            >
              {/* Day number */}
              <span
                className={[
                  'text-sm font-semibold leading-none',
                  isToday
                    ? 'bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                    : '',
                ].join(' ')}
              >
                {day.getDate()}
              </span>

              {/* Attendance mini-count */}
              {recs.length > 0 && (
                <span
                  className={[
                    'text-[10px] font-medium leading-none',
                    pct >= 0.8 ? 'text-white/80' : 'opacity-60',
                  ].join(' ')}
                >
                  {checkedIn}/{activeEmployeeCount > 0 ? activeEmployeeCount : recs.length}
                </span>
              )}
            </button>
          );
        })}

        {/* Trailing empty cells */}
        {Array.from({ length: trailingCells }).map((_, i) => (
          <div
            key={`trail-${i}`}
            className="h-14 border-b border-border-color border-r last:border-r-0"
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap px-4 py-2.5 border-t border-border-color bg-bg-secondary/40">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
          Attendance rate:
        </span>
        {[
          { cls: 'bg-bg-secondary border border-border-color', label: 'No data' },
          { cls: 'bg-green-100 dark:bg-green-900/30',          label: '< 50%' },
          { cls: 'bg-green-300 dark:bg-green-700/60',          label: '50–80%' },
          { cls: 'bg-green-500 dark:bg-green-600',             label: '> 80%' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm shrink-0 ${cls}`} />
            <span className="text-[11px] text-text-secondary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
