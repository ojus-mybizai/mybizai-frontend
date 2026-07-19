/**
 * Shared, deterministic colour vocabulary for datasheet VALUES (enum options,
 * statuses, group keys, kanban columns, calendar events…).
 *
 * ONE source of truth: a given value (e.g. "Web App", "Active", "Lost") resolves
 * to the SAME hue everywhere — table pills, list, card, kanban and calendar — so
 * the same status reads as the same colour across every view.
 *
 * Every class string is a literal so Tailwind's JIT can see it. Never build these
 * at runtime. Text colours use `-700` (light) / `-300` (dark); the app's `dark:`
 * variant is class-based (see globals.css `@custom-variant dark`) so both stay
 * readable in the correct theme.
 */

export type ValueHue =
  | 'blue' | 'green' | 'purple' | 'amber' | 'rose'
  | 'cyan' | 'indigo' | 'teal' | 'orange' | 'pink' | 'slate';

export interface ValueColor {
  hue: ValueHue;
  /** Soft pill: tinted bg + readable text + subtle ring. Use for chips/badges. */
  chip: string;
  /** Solid, saturated fill + white text. Use for strong/active emphasis. */
  solid: string;
  /** Faint surface wash + matching border. Use for cards / lanes / event bodies. */
  soft: string;
  /** Just the faint surface bg (no border). */
  softBg: string;
  /** Border tint only. */
  border: string;
  /** Toned text colour only. */
  text: string;
  /** Solid indicator swatch (bg-*-500) — dots, rails, bars. */
  dot: string;
  /** Solid raw hex for the 500 shade — for inline styles (SVG, gradients). */
  hex: string;
}

/* Per-hue class bundles. All literal for JIT. */
export const HUES: Record<ValueHue, ValueColor> = {
  blue: {
    hue: 'blue',
    chip: 'bg-blue-100 text-blue-700 ring-blue-200/70 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800/40',
    solid: 'bg-blue-600 text-white dark:bg-blue-500',
    soft: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50',
    softBg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    hex: '#3b82f6',
  },
  green: {
    hue: 'green',
    chip: 'bg-green-100 text-green-700 ring-green-200/70 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800/40',
    solid: 'bg-green-600 text-white dark:bg-green-500',
    soft: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/50',
    softBg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800/50',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
    hex: '#22c55e',
  },
  purple: {
    hue: 'purple',
    chip: 'bg-purple-100 text-purple-700 ring-purple-200/70 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-800/40',
    solid: 'bg-purple-600 text-white dark:bg-purple-500',
    soft: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800/50',
    softBg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800/50',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-500',
    hex: '#a855f7',
  },
  amber: {
    hue: 'amber',
    chip: 'bg-amber-100 text-amber-700 ring-amber-200/70 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/40',
    solid: 'bg-amber-500 text-white dark:bg-amber-500',
    soft: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50',
    softBg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  rose: {
    hue: 'rose',
    chip: 'bg-rose-100 text-rose-700 ring-rose-200/70 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800/40',
    solid: 'bg-rose-600 text-white dark:bg-rose-500',
    soft: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/50',
    softBg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/50',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    hex: '#f43f5e',
  },
  cyan: {
    hue: 'cyan',
    chip: 'bg-cyan-100 text-cyan-700 ring-cyan-200/70 dark:bg-cyan-900/30 dark:text-cyan-300 dark:ring-cyan-800/40',
    solid: 'bg-cyan-600 text-white dark:bg-cyan-500',
    soft: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800/50',
    softBg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-800/50',
    text: 'text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    hex: '#06b6d4',
  },
  indigo: {
    hue: 'indigo',
    chip: 'bg-indigo-100 text-indigo-700 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/40',
    solid: 'bg-indigo-600 text-white dark:bg-indigo-500',
    soft: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800/50',
    softBg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
    hex: '#6366f1',
  },
  teal: {
    hue: 'teal',
    chip: 'bg-teal-100 text-teal-700 ring-teal-200/70 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-800/40',
    solid: 'bg-teal-600 text-white dark:bg-teal-500',
    soft: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800/50',
    softBg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800/50',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
    hex: '#14b8a6',
  },
  orange: {
    hue: 'orange',
    chip: 'bg-orange-100 text-orange-700 ring-orange-200/70 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800/40',
    solid: 'bg-orange-500 text-white dark:bg-orange-500',
    soft: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/50',
    softBg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
  pink: {
    hue: 'pink',
    chip: 'bg-pink-100 text-pink-700 ring-pink-200/70 dark:bg-pink-900/30 dark:text-pink-300 dark:ring-pink-800/40',
    solid: 'bg-pink-600 text-white dark:bg-pink-500',
    soft: 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800/50',
    softBg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800/50',
    text: 'text-pink-700 dark:text-pink-300',
    dot: 'bg-pink-500',
    hex: '#ec4899',
  },
  slate: {
    hue: 'slate',
    chip: 'bg-slate-100 text-slate-700 ring-slate-200/70 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/40',
    solid: 'bg-slate-600 text-white dark:bg-slate-500',
    soft: 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/50',
    softBg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700/50',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
    hex: '#64748b',
  },
};

/** Ordered hue ring used for hashing arbitrary values into stable colours. */
const HASH_ORDER: ValueHue[] = ['blue', 'purple', 'cyan', 'pink', 'indigo', 'teal', 'orange'];

/** Status semantics → fixed hue, so "won/active" is always green, "lost" always rose, etc. */
const STATUS_MAP: Array<{ test: RegExp; hue: ValueHue }> = [
  { test: /^(done|won|complete|completed|success|active|approved|paid|yes|ok|live|resolved|published|open)$/i, hue: 'green' },
  { test: /^(failed|fail|lost|cancel|cancelled|canceled|reject|rejected|blocked|error|no|overdue|expired)$/i, hue: 'rose' },
  { test: /^(pending|in[\s_-]?progress|review|reviewing|warn|warning|hold|on[\s_-]?hold|waiting|processing|scheduled)$/i, hue: 'amber' },
  { test: /^(new|todo|to[\s_-]?do|info|draft|backlog|planned)$/i, hue: 'blue' },
  { test: /^(archived|closed|inactive|disabled|deleted)$/i, hue: 'slate' },
  // Priority-specific
  { test: /^(urgent|high|critical|p0|p1)$/i, hue: 'rose' },
  { test: /^(medium|normal|p2)$/i, hue: 'amber' },
  { test: /^(low|p3|p4)$/i, hue: 'blue' },
];

const STATUS_FIELD_RE = /(status|stage|priority|state|phase|level|severity|kind|type)/i;

function hashHue(s: string): ValueHue {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return HASH_ORDER[Math.abs(hash) % HASH_ORDER.length];
}

/** Minimal field shape needed to resolve a value's hue. */
export interface HueField {
  name: string;
  display_name?: string;
  config?: Record<string, unknown> | null;
}

/**
 * Resolve the stable {@link ValueHue} for a value within a field. Status-like
 * fields map known words to fixed semantic hues; everything else hashes to a
 * stable colour. Deterministic across renders and across every view.
 */
export function resolveHue(field: HueField | null | undefined, value: string): ValueHue {
  const v = value.trim();
  const name = field?.name ?? '';
  const display = field?.display_name ?? '';
  if (STATUS_FIELD_RE.test(name) || STATUS_FIELD_RE.test(display)) {
    for (const m of STATUS_MAP) if (m.test.test(v)) return m.hue;
  }
  return hashHue(v);
}

/** Full colour bundle for a value. */
export function valueColor(field: HueField | null | undefined, value: string): ValueColor {
  return HUES[resolveHue(field, value)];
}
