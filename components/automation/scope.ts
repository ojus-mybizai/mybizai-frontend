/**
 * deriveScope — pure mapping from a rule's trigger to the surface it belongs to
 * (AUTOMATION_REDESIGN_SPEC §8). No scope columns exist; the datasheet id lives
 * in `trigger.filters.datasheet_id`. This is the ONE place that parses it, so a
 * later move to real scope columns is a single-file change.
 */

import type { AutomationRule } from '@/services/automation';

export type ScopeSurface = 'datasheet' | 'pipeline' | 'contacts' | 'call' | 'schedule' | 'global';

export interface RuleScope {
  surface: ScopeSurface;
  /** Datasheet id for datasheet-scoped rules; null otherwise. */
  datasheetId: number | null;
}

export function deriveScope(rule: Pick<AutomationRule, 'trigger'>): RuleScope {
  const event = rule.trigger?.event || '';
  if (event.startsWith('record.')) {
    const raw = (rule.trigger?.filters as Record<string, unknown> | undefined)?.datasheet_id;
    const id = raw == null ? null : Number(raw);
    return { surface: 'datasheet', datasheetId: Number.isFinite(id as number) ? (id as number) : null };
  }
  if (event.startsWith('process.')) return { surface: 'pipeline', datasheetId: null };
  if (event.startsWith('contact.')) return { surface: 'contacts', datasheetId: null };
  if (event.startsWith('call.')) return { surface: 'call', datasheetId: null };
  if (event.startsWith('schedule.')) return { surface: 'schedule', datasheetId: null };
  return { surface: 'global', datasheetId: null };
}

/** Rules whose derived scope is this datasheet. */
export function rulesForDatasheet(rules: AutomationRule[], datasheetId: number): AutomationRule[] {
  return rules.filter((r) => {
    const s = deriveScope(r);
    return s.surface === 'datasheet' && s.datasheetId === datasheetId;
  });
}
