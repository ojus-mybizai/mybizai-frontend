/**
 * Canvas tone system — the shared semantic colour vocabulary for the block kit.
 *
 * A `tone` is meaning, not a raw colour: the AI (or a specialist producer) tags a
 * card / stat / section with what it MEANS (a healthy metric → success, something
 * needing attention → warning, a problem → danger, a neutral fact → info, the
 * primary/brand thing → accent) and this table turns that into the exact Tailwind
 * classes used across the app's dashboard widgets. Every class string is a literal
 * so Tailwind's JIT can see it — never build these at runtime.
 */

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ToneClasses {
  /** Small icon/emoji chip in a card or section header (bg + text). */
  chip: string;
  /** Card border tint. */
  border: string;
  /** Thin accent bar (left rail) colour. */
  bar: string;
  /** Accent text — headings / stat values that should carry the tone. */
  text: string;
  /** Very subtle surface wash for a toned card (kept faint on purpose). */
  tint: string;
}

export const TONES: Record<Tone, ToneClasses> = {
  accent: {
    chip: 'bg-accent-soft text-accent',
    border: 'border-accent/30',
    bar: 'bg-accent',
    text: 'text-accent',
    tint: 'bg-accent-soft/30',
  },
  success: {
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    tint: 'bg-emerald-50/60 dark:bg-emerald-500/[0.06]',
  },
  warning: {
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/30',
    bar: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    tint: 'bg-amber-50/60 dark:bg-amber-500/[0.06]',
  },
  danger: {
    chip: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/30',
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    tint: 'bg-red-50/60 dark:bg-red-500/[0.06]',
  },
  info: {
    chip: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/30',
    bar: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    tint: 'bg-blue-50/60 dark:bg-blue-500/[0.06]',
  },
  neutral: {
    chip: 'bg-bg-secondary text-text-secondary',
    border: 'border-border-color',
    bar: 'bg-border-color',
    text: 'text-text-primary',
    tint: '',
  },
};

/** Resolve a (possibly unknown / undefined) tone string to its class set. */
export function toneOf(t?: string | null): ToneClasses {
  return TONES[(t as Tone) ?? 'neutral'] ?? TONES.neutral;
}

/** Whether a tone actually carries colour (drives the icon-chip / bar affordances). */
export function isColoredTone(t?: string | null): boolean {
  return !!t && t !== 'neutral' && t in TONES;
}
