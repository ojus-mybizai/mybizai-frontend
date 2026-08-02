'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Check } from 'lucide-react';
import {
  useDateRangeStore,
  computePresetRange,
  type DatePreset,
} from '@/lib/stores/date-range-store';
import { formatDate } from '@/lib/format-date';
import { DateField } from '@/components/ui/date-field';

interface Preset {
  id: DatePreset;
  label: string;
  group?: string;
}

const PRESETS: Preset[] = [
  { id: 'today',         label: 'Today',          group: 'Quick' },
  { id: 'yesterday',     label: 'Yesterday',      group: 'Quick' },
  { id: 'this_week',     label: 'This Week',      group: 'Week' },
  { id: 'last_week',     label: 'Last Week',      group: 'Week' },
  { id: 'month_to_date', label: 'Month to Date',  group: 'Month' },
  { id: 'last_month',    label: 'Last Month',     group: 'Month' },
  { id: 'last_7_days',   label: 'Last 7 Days',    group: 'Rolling' },
  { id: 'last_30_days',  label: 'Last 30 Days',   group: 'Rolling' },
  { id: 'last_90_days',  label: 'Last 90 Days',   group: 'Rolling' },
  { id: 'custom',        label: 'Custom Range',   group: 'Custom' },
];

function formatDisplay(start: string, end: string, preset: DatePreset): string {
  const labelMap: Partial<Record<DatePreset, string>> = {
    today:         'Today',
    yesterday:     'Yesterday',
    this_week:     'This Week',
    last_week:     'Last Week',
    month_to_date: 'Month to Date',
    last_month:    'Last Month',
    last_7_days:   'Last 7 Days',
    last_30_days:  'Last 30 Days',
    last_90_days:  'Last 90 Days',
  };
  if (preset !== 'custom' && labelMap[preset]) return labelMap[preset]!;
  // custom or fallback — show date range
  const fmt = (s: string) => formatDate(s);
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

interface DateRangePickerProps {
  /** If provided, the picker manages its own local state and calls onChange instead of writing to the global store. */
  value?: { startDate: string; endDate: string; preset: DatePreset };
  onChange?: (start: string, end: string, preset: DatePreset) => void;
  /** Extra classes on the trigger button */
  className?: string;
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const store = useDateRangeStore();

  // Controlled (local) vs uncontrolled (global store)
  const isControlled = value !== undefined && onChange !== undefined;
  const current = isControlled ? value : { startDate: store.startDate, endDate: store.endDate, preset: store.preset };

  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(current.startDate);
  const [customEnd, setCustomEnd] = useState(current.endDate);
  const [pendingPreset, setPendingPreset] = useState<DatePreset>(current.preset);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Sync custom inputs when the picker opens
  useEffect(() => {
    if (open) {
      setCustomStart(current.startDate);
      setCustomEnd(current.endDate);
      setPendingPreset(current.preset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyPreset(preset: DatePreset) {
    if (preset === 'custom') {
      setPendingPreset('custom');
      return;
    }
    const { start, end } = computePresetRange(preset);
    if (isControlled) {
      onChange(start, end, preset);
    } else {
      store.setPreset(preset);
    }
    setOpen(false);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = customStart <= customEnd ? customStart : customEnd;
    const end   = customStart <= customEnd ? customEnd   : customStart;
    if (isControlled) {
      onChange(start, end, 'custom');
    } else {
      store.setRange(start, end, 'custom');
    }
    setOpen(false);
  }

  const groups = [...new Set(PRESETS.map((p) => p.group))];

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CalendarDays size={15} className="shrink-0 text-text-secondary" />
        <span className="max-w-[180px] truncate">
          {formatDisplay(current.startDate, current.endDate, current.preset)}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] rounded-xl border border-border-color bg-bg-primary shadow-xl">
          <div className="flex divide-x divide-border-color">
            {/* Left: presets */}
            <div className="w-44 shrink-0 overflow-y-auto py-2">
              {groups.map((group) => (
                <div key={group}>
                  <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                    {group}
                  </p>
                  {PRESETS.filter((p) => p.group === group).map((p) => {
                    const isActive =
                      p.id !== 'custom'
                        ? current.preset === p.id
                        : current.preset === 'custom' || pendingPreset === 'custom';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (p.id === 'custom') {
                            setPendingPreset('custom');
                            setCustomStart(current.startDate);
                            setCustomEnd(current.endDate);
                          } else {
                            applyPreset(p.id);
                          }
                        }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-accent/10 font-semibold text-accent'
                            : 'text-text-primary hover:bg-bg-secondary'
                        }`}
                      >
                        {p.label}
                        {isActive && <Check size={13} className="shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Right: custom date inputs — always visible so user can see current range */}
            <div className="flex flex-1 flex-col gap-3 p-4">
              <p className="text-xs font-semibold text-text-secondary">
                {pendingPreset === 'custom' ? 'Pick custom range' : 'Current range'}
              </p>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">From</span>
                <DateField
                  value={pendingPreset === 'custom' ? customStart : current.startDate}
                  onChange={(iso) => {
                    setPendingPreset('custom');
                    setCustomStart(iso);
                  }}
                  max={customEnd || undefined}
                  className="w-full rounded-md border border-border-color bg-bg-secondary px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">To</span>
                <DateField
                  value={pendingPreset === 'custom' ? customEnd : current.endDate}
                  onChange={(iso) => {
                    setPendingPreset('custom');
                    setCustomEnd(iso);
                  }}
                  min={customStart || undefined}
                  className="w-full rounded-md border border-border-color bg-bg-secondary px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              {pendingPreset === 'custom' && (
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!customStart || !customEnd}
                  className="mt-auto rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Apply Range
                </button>
              )}

              {pendingPreset !== 'custom' && (
                <div className="mt-auto rounded-md bg-bg-secondary px-3 py-2 text-center text-xs text-text-secondary">
                  Select "Custom Range" to pick exact dates
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
