/**
 * Adapter to sync table query state (page, sort, filters, keyword, view) with URL search params.
 * Enables shareable links and refresh persistence without global state.
 */

export interface QueryParamsState {
  page: number;
  per_page: number;
  sort: Array<{ field: string; direction: string }>;
  filters: Array<{ field: string; op: string; value: unknown }>;
  keyword: string;
  view_id: string | null;
}

const DEFAULT_STATE: QueryParamsState = {
  page: 1,
  per_page: 25,
  sort: [],
  filters: [],
  keyword: '',
  view_id: null,
};

function parseJsonSafe<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function queryParamsFromSearchParams(searchParams: URLSearchParams): QueryParamsState {
  return {
    page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
    per_page: Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10) || 25)),
    sort: parseJsonSafe(searchParams.get('sort'), DEFAULT_STATE.sort),
    filters: parseJsonSafe(searchParams.get('filters'), DEFAULT_STATE.filters),
    keyword: searchParams.get('keyword') ?? '',
    view_id: searchParams.get('view_id') || null,
  };
}

export function queryParamsToSearchParams(state: Partial<QueryParamsState>): URLSearchParams {
  const params = new URLSearchParams();
  if (state.page != null && state.page !== 1) params.set('page', String(state.page));
  if (state.per_page != null && state.per_page !== 25) params.set('per_page', String(state.per_page));
  if (state.sort != null && state.sort.length > 0) params.set('sort', JSON.stringify(state.sort));
  if (state.filters != null && state.filters.length > 0) params.set('filters', JSON.stringify(state.filters));
  if (state.keyword != null && state.keyword.trim()) params.set('keyword', state.keyword.trim());
  if (state.view_id != null && state.view_id) params.set('view_id', state.view_id);
  return params;
}

export function buildQueryParamsUrl(pathname: string, state: Partial<QueryParamsState>): string {
  const params = queryParamsToSearchParams(state);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
