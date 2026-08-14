import { apiFetch, type ApiError } from '@/lib/api-client';

export type ActivitySource = 'whatsapp' | 'app' | 'task' | 'system';

export interface ActivityEvent {
  id: string;
  source: ActivitySource;
  kind: string;
  member_id: number | null;
  actor_name: string | null;
  contact_id: number | null;
  contact_name: string | null;
  summary: string;
  detail: string | null;
  created_at: string;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  next_cursor: string | null;
}

export async function getMemberActivity(
  memberId: number,
  opts?: { sources?: ActivitySource[]; since?: string; cursor?: string },
): Promise<ActivityFeedResponse> {
  const qs = new URLSearchParams();
  if (opts?.since) qs.set('since', opts.since);
  if (opts?.cursor) qs.set('cursor', opts.cursor);
  if (opts?.sources?.length) qs.set('sources', opts.sources.join(','));
  const query = qs.toString();
  try {
    return await apiFetch<ActivityFeedResponse>(
      `/activity/member/${memberId}${query ? `?${query}` : ''}`,
      { method: 'GET', auth: true },
    );
  } catch (e) {
    const err = e as ApiError;
    if (err?.status === 404) return { events: [], next_cursor: null };
    throw err;
  }
}
