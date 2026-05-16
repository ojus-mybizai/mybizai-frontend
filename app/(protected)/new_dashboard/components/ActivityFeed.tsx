'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface ActivityItem {
  id: number;
  actor_name: string;
  action_type: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}
interface Response { items: ActivityItem[]; next_cursor: number | null; }

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '#';
}

export function ActivityFeed() {
  const [items, setItems]     = useState<ActivityItem[]>([]);
  const [cursor, setCursor]   = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (c: number | null) => {
    const params = new URLSearchParams({ limit: '15' });
    if (c) params.set('cursor', String(c));
    return apiFetch<Response>(`/widgets/activity?${params.toString()}`);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(null)
      .then((r) => { setItems(r.items); setCursor(r.next_cursor); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await load(cursor);
      setItems((prev) => [...prev, ...r.items]);
      setCursor(r.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="bg-card-bg border border-border-color rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
          <Activity size={15} className="text-cyan-500" />
        </div>
        <p className="text-sm font-semibold text-text-primary flex-1">Recent Activity</p>
        <a href="/activity" className="flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent">
          All <ArrowUpRight size={11} />
        </a>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-12 bg-bg-secondary rounded-xl animate-pulse" />))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-text-secondary text-sm py-6 text-center">No activity yet</p>
      ) : (
        <>
          <div className="space-y-0.5">
            {items.map((it) => {
              const verb = it.action_type.replace(/_/g, ' ');
              return (
                <div key={it.id} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors">
                  <span className="w-7 h-7 rounded-full shrink-0 bg-bg-secondary text-text-secondary flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {initials(it.actor_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-snug">
                      <span className="font-semibold">{it.actor_name}</span>
                      <span className="text-text-secondary"> · {verb}</span>
                      {it.entity_name && <span className="text-text-secondary"> — {it.entity_name}</span>}
                    </p>
                  </div>
                  <span className="text-[11px] text-text-secondary tabular-nums shrink-0 mt-1">{timeAgo(it.created_at)}</span>
                </div>
              );
            })}
          </div>
          {cursor && (
            <div className="mt-3 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-xs font-semibold text-accent hover:underline disabled:opacity-40"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
