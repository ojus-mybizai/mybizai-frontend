'use client';

import { create } from 'zustand';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'month_to_date'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export interface DateRangeState {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  preset: DatePreset;
  setRange: (startDate: string, endDate: string, preset: DatePreset) => void;
  setPreset: (preset: DatePreset) => void;
  /** Computed: days between startDate and endDate (inclusive, min 1). Used for reports APIs that accept `days`. */
  toDays: () => number;
  /** ISO timestamp strings ready for analytics APIs. */
  toISORange: () => { start_date: string; end_date: string };
}

function fmt(d: Date): string {
  // Local calendar date (YYYY-MM-DD) — NOT toISOString(), which is UTC and
  // rolls a day backward for positive-offset zones (e.g. IST +05:30). Using
  // UTC made "Last 30 days" end yesterday for IST users, hiding today's rows.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function computePresetRange(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today': {
      const s = fmt(today);
      return { start: s, end: s };
    }
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const s = fmt(y);
      return { start: s, end: s };
    }
    case 'this_week': {
      return { start: fmt(startOfWeek(today)), end: fmt(today) };
    }
    case 'last_week': {
      const lastMon = startOfWeek(today);
      lastMon.setDate(lastMon.getDate() - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      return { start: fmt(lastMon), end: fmt(lastSun) };
    }
    case 'month_to_date': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(first), end: fmt(today) };
    }
    case 'last_month': {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: fmt(firstOfLastMonth), end: fmt(lastOfLastMonth) };
    }
    case 'last_7_days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 6);
      return { start: fmt(s), end: fmt(today) };
    }
    case 'last_30_days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 29);
      return { start: fmt(s), end: fmt(today) };
    }
    case 'last_90_days': {
      const s = new Date(today);
      s.setDate(today.getDate() - 89);
      return { start: fmt(s), end: fmt(today) };
    }
    default: {
      const s = new Date(today);
      s.setDate(today.getDate() - 29);
      return { start: fmt(s), end: fmt(today) };
    }
  }
}

const defaultPreset: DatePreset = 'last_30_days';
const defaultRange = computePresetRange(defaultPreset);

export const useDateRangeStore = create<DateRangeState>()((set, get) => ({
  startDate: defaultRange.start,
  endDate: defaultRange.end,
  preset: defaultPreset,

  setRange: (startDate, endDate, preset) => set({ startDate, endDate, preset }),

  setPreset: (preset) => {
    if (preset === 'custom') return; // custom range must use setRange directly
    const { start, end } = computePresetRange(preset);
    set({ startDate: start, endDate: end, preset });
  },

  toDays: () => {
    const { startDate, endDate } = get();
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.round(ms / 86400000) + 1);
  },

  toISORange: () => {
    const { startDate, endDate } = get();
    return {
      start_date: `${startDate}T00:00:00`,
      end_date: `${endDate}T23:59:59`,
    };
  },
}));
