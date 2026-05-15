'use client';

import React, { useEffect, useState } from 'react';
import { getProcessActivity, type ActivityEvent } from '@/services/processes';
import { Avatar, relativeTime } from './shared';

interface Props { processId: number; }

const EVENT_ICONS: Record<string, string> = {
  process_added: '➕',
  process_stage_changed: '↔',
  stage_changed: '↔',
  process_removed: '➖',
};

const EVENT_LABELS: Record<string, string> = {
  process_added: 'Added to pipeline',
  process_stage_changed: 'Stage changed',
  stage_changed: 'Stage changed',
  process_removed: 'Removed',
};

export default function ActivityView({ processId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    getProcessActivity(processId, 50, 0)
      .then(res => { setEvents(res.events); setHasMore(res.has_more); setOffset(50); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [processId]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await getProcessActivity(processId, 50, offset);
      setEvents(prev => [...prev, ...res.events]);
      setHasMore(res.has_more);
      setOffset(o => o + 50);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-bg-secondary animate-pulse" />)}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-text-secondary text-center py-8">No activity yet.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={`${ev.entity_type}-${ev.id}`} className="flex gap-2 rounded-lg border border-border-color bg-card-bg p-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-bg-secondary flex items-center justify-center text-base">
            {EVENT_ICONS[ev.type] || '•'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-text-primary">{EVENT_LABELS[ev.type] || ev.type}</span>
              <span className="text-[10px] text-text-secondary">{relativeTime(ev.created_at)}</span>
            </div>
            <p className="text-xs text-text-secondary">{ev.description}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-secondary">
              {ev.actor_name && (
                <>
                  <Avatar name={ev.actor_name} size="xs" />
                  <span>{ev.actor_name}</span>
                </>
              )}
              {ev.metadata?.from_stage && ev.metadata?.to_stage && (
                <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 font-medium">
                  {ev.metadata.from_stage} → {ev.metadata.to_stage}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2 text-xs font-medium rounded-md border border-border-color bg-bg-primary hover:bg-bg-secondary text-text-secondary disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
