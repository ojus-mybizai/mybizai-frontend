/**
 * Module-local view state: column visibility and last active view per model.
 * Not global app state; scoped by modelId. Can be persisted to localStorage keyed by modelId.
 */

const STORAGE_KEY_PREFIX = 'data-sheet-view:';

export interface ViewStateSnapshot {
  visibleColumns: Set<string> | null; // null = all visible
  sort: Array<{ field: string; direction: string }>;
  filters: Array<{ field: string; op: string; value: unknown }>;
  keyword: string;
}

export function getStoredViewState(modelId: string): ViewStateSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + modelId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      visibleColumns?: string[] | null;
      sort?: ViewStateSnapshot['sort'];
      filters?: ViewStateSnapshot['filters'];
      keyword?: string;
    };
    return {
      visibleColumns:
        Array.isArray(parsed.visibleColumns) && parsed.visibleColumns.length > 0
          ? new Set(parsed.visibleColumns)
          : null,
      sort: Array.isArray(parsed.sort) ? parsed.sort : [],
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '',
    };
  } catch {
    return null;
  }
}

export function setStoredViewState(modelId: string, snapshot: ViewStateSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      visibleColumns:
        snapshot.visibleColumns === null ? null : Array.from(snapshot.visibleColumns),
      sort: snapshot.sort,
      filters: snapshot.filters,
      keyword: snapshot.keyword,
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + modelId, JSON.stringify(payload));
  } catch {
    // ignore
  }
}
