/**
 * Module-local view state: column visibility, view mode, and last active view per model.
 * Not global app state; scoped by modelId. Can be persisted to localStorage keyed by modelId.
 */

const STORAGE_KEY_PREFIX = 'data-sheet-view:';

export type ViewMode = 'table' | 'card' | 'list' | 'calendar' | 'kanban';

export interface CardViewConfig {
  /** Field names to show on card (null = first 4 fields) */
  cardFields: string[] | null;
  /** Number of columns in card grid (2, 3, 4) */
  gridCols: 2 | 3 | 4;
}

export interface ListViewConfig {
  /** Field name used as title line */
  titleField: string | null;
  /** Field names shown as subtitle details (null = first 3 fields) */
  detailFields: string[] | null;
}

export interface CalendarViewConfig {
  /** Field name of type 'date' used to place records on calendar dates */
  dateField: string | null;
  /** Field names shown on calendar pills (null = first 2 text fields) */
  pillFields: string[] | null;
}

export interface KanbanViewConfig {
  /** Field name of type 'enum' used to group records into columns */
  groupByField: string | null;
  /** Field names shown on kanban cards (null = first 3 fields) */
  cardFields: string[] | null;
}

export interface ViewStateSnapshot {
  visibleColumns: Set<string> | null; // null = all visible
  sort: Array<{ field: string; direction: string }>;
  filters: Array<{ field: string; op: string; value?: unknown }>;
  keyword: string;
  viewMode: ViewMode;
  cardConfig: CardViewConfig;
  listConfig: ListViewConfig;
  calendarConfig: CalendarViewConfig;
  kanbanConfig: KanbanViewConfig;
}

const DEFAULT_CARD_CONFIG: CardViewConfig = { cardFields: null, gridCols: 3 };
const DEFAULT_LIST_CONFIG: ListViewConfig = { titleField: null, detailFields: null };
const DEFAULT_CALENDAR_CONFIG: CalendarViewConfig = { dateField: null, pillFields: null };
const DEFAULT_KANBAN_CONFIG: KanbanViewConfig = { groupByField: null, cardFields: null };

const VALID_VIEW_MODES: ViewMode[] = ['table', 'card', 'list', 'calendar', 'kanban'];

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
      viewMode?: ViewMode;
      cardConfig?: CardViewConfig;
      listConfig?: ListViewConfig;
      calendarConfig?: CalendarViewConfig;
      kanbanConfig?: KanbanViewConfig;
    };
    return {
      visibleColumns:
        Array.isArray(parsed.visibleColumns) && parsed.visibleColumns.length > 0
          ? new Set(parsed.visibleColumns)
          : null,
      sort: Array.isArray(parsed.sort) ? parsed.sort : [],
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '',
      viewMode: VALID_VIEW_MODES.includes(parsed.viewMode as ViewMode) ? parsed.viewMode as ViewMode : 'table',
      cardConfig: parsed.cardConfig ?? DEFAULT_CARD_CONFIG,
      listConfig: parsed.listConfig ?? DEFAULT_LIST_CONFIG,
      calendarConfig: parsed.calendarConfig ?? DEFAULT_CALENDAR_CONFIG,
      kanbanConfig: parsed.kanbanConfig ?? DEFAULT_KANBAN_CONFIG,
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
      viewMode: snapshot.viewMode,
      cardConfig: snapshot.cardConfig,
      listConfig: snapshot.listConfig,
      calendarConfig: snapshot.calendarConfig,
      kanbanConfig: snapshot.kanbanConfig,
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + modelId, JSON.stringify(payload));
  } catch {
    // ignore
  }
}
