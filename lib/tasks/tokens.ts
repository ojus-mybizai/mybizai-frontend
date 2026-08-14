/**
 * Universal tokens available in every task template — resolved server-side
 * inside `substitute()` before variable lookup.
 */
export const UNIVERSAL_TOKENS: { path: string; label: string; hint?: string }[] = [
  { path: 'today', label: 'Today', hint: '20 Aug 2026' },
  { path: 'now', label: 'Now', hint: '20 Aug 2026 14:32' },
  { path: 'me.name', label: 'My name' },
  { path: 'me.first_name', label: 'My first name' },
  { path: 'me.role', label: 'My role' },
  { path: 'assignee.name', label: 'Assignee name' },
  { path: 'assignee.first_name', label: 'Assignee first name' },
  { path: 'business.name', label: 'Business name' },
];

export function isUniversalToken(path: string): boolean {
  return UNIVERSAL_TOKENS.some((t) => t.path === path);
}
