/**
 * Central date formatting for the whole frontend.
 *
 * The app standardises on the "date month year" order everywhere:
 *   formatDate      → "20 Jul 2026"
 *   formatDateTime  → "20 Jul 2026, 3:40 PM"   (date part reordered, time kept)
 *   formatDayMonth  → "20 Jul"                  (compact, same day-first order)
 *
 * Always prefer these helpers over ad-hoc `toLocaleDateString(...)` calls so the
 * order stays consistent regardless of the viewer's OS locale (which is what
 * silently flips `toLocaleDateString()` between DD/MM and MM/DD).
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type DateInput = string | number | Date | null | undefined;

/** Parse any accepted input into a valid Date, or null. Date-only strings
 *  ("2026-07-20") are parsed in local time to avoid an off-by-one day shift. */
export function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    d = new Date(`${input}T00:00:00`);
  } else {
    d = new Date(input);
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "20 Jul 2026" */
export function formatDate(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  if (!d) return fallback;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "20 Jul 2026, 3:40 PM" */
export function formatDateTime(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  if (!d) return fallback;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${formatDate(d)}, ${h}:${mm} ${ampm}`;
}

/** "3:40 PM" — time only. */
export function formatTime(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  if (!d) return fallback;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${mm} ${ampm}`;
}

/** "20 Jul" — compact day + month, same day-first order (no year). */
export function formatDayMonth(input: DateInput, fallback = '—'): string {
  const d = toDate(input);
  if (!d) return fallback;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** ISO date component "2026-07-20" (local), for `<input type="date">` values
 *  and DateField storage. Returns '' for invalid input. */
export function toISODate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
