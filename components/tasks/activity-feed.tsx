'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, MessageSquare, Smartphone, ListChecks, Cog, Loader2,
} from 'lucide-react';
import { activityKeys } from '@/lib/tasks/keys';
import { getMemberActivity, type ActivityEvent, type ActivitySource } from '@/services/activity';
import { formatDateTime, formatDayMonth } from '@/lib/format-date';

const SOURCE_META: Record<ActivitySource, { label: string; Icon: typeof Activity; tone: string }> = {
  whatsapp: { label: 'WhatsApp', Icon: MessageSquare, tone: 'text-emerald-500 bg-emerald-500/10' },
  app:      { label: 'App',      Icon: Smartphone,    tone: 'text-tc-info bg-tc-info-soft' },
  task:     { label: 'Tasks',    Icon: ListChecks,    tone: 'text-tc-accent bg-tc-accent-soft' },
  system:   { label: 'System',   Icon: Cog,           tone: 'text-tc-ink-muted bg-tc-bg-card-2' },
};

const FILTERS: Array<{ key: 'all' | ActivitySource; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'app', label: 'App' },
  { key: 'task', label: 'Tasks' },
];

export function ActivityFeed({ memberId, memberName }: { memberId: number; memberName: string }) {
  const [filter, setFilter] = useState<'all' | ActivitySource>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: activityKeys.member(memberId),
    queryFn: () => getMemberActivity(memberId),
    staleTime: 30_000,
  });

  const events = data?.events ?? [];

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.source === filter)),
    [events, filter],
  );

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-tc-rule bg-tc-bg-card px-4 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-tc-chip px-2 py-1 text-xs transition-colors ${
              filter === f.key
                ? 'bg-tc-accent-soft text-tc-accent'
                : 'text-tc-ink-muted hover:text-tc-ink-2'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-tc-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading activity…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-tc-ink-muted">
            <Activity className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-tc-ink-2">Activity feed unavailable</p>
            <p className="mt-1 max-w-sm text-xs">
              Backend endpoint <code className="font-mono">/api/v1/activity</code> not shipped yet.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-tc-ink-muted">
            <Activity className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-tc-ink-2">
              No {filter === 'all' ? '' : `${SOURCE_META[filter as ActivitySource].label} `}activity in the last 30 days for {memberName}.
            </p>
          </div>
        ) : (
          <div className="p-4">
            {grouped.map(([day, evs]) => (
              <section key={day} className="mb-6 last:mb-0">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
                  {day}
                </div>
                <ul className="space-y-2">
                  {evs.map((e) => <Row key={e.id} event={e} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ event }: { event: ActivityEvent }) {
  const meta = SOURCE_META[event.source] ?? SOURCE_META.system;
  return (
    <li className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <meta.Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-tc-ink">{event.summary}</p>
        {event.detail && (
          <p className="mt-0.5 truncate text-xs text-tc-ink-muted">{event.detail}</p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-tc-ink-muted">
          {formatDateTime(event.created_at)}
        </p>
      </div>
    </li>
  );
}

function groupByDay(events: ActivityEvent[]): Array<[string, ActivityEvent[]]> {
  const map = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const key = formatDayMonth(e.created_at);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.entries());
}
