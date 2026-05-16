'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Radio, Bot, ArrowUpRight, CircleAlert, CircleCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface ChannelRow {
  id: number;
  type: string;
  name: string;
  is_connected: boolean;
  last_message_at: string | null;
  agent_id: number | null;
  agent_name: string | null;
  href: string;
}
interface AgentRecent {
  id: number;
  name: string;
  status: string;
  role_type: string;
  last_run_at: string | null;
  total_runs: number;
  href: string;
}

const STATUS_CLS: Record<string, string> = {
  active:   'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  paused:   'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  draft:    'bg-bg-secondary text-text-secondary',
  archived: 'bg-bg-secondary text-text-secondary opacity-60',
};

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ChannelsAgentsHealth() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [agents, setAgents]     = useState<{ by_status: Record<string, number>; total: number; recent: AgentRecent[] }>({
    by_status: {}, total: 0, recent: [],
  });
  const [loading, setLoading]   = useState(true);
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ channels: ChannelRow[]; connected_count: number }>('/widgets/channels-health'),
      apiFetch<typeof agents>('/widgets/agents-health'),
    ])
      .then(([c, a]) => {
        setChannels(c.channels);
        setConnectedCount(c.connected_count);
        setAgents(a);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-7 grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Channels */}
      <div className="bg-card-bg border border-border-color rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-500/15 flex items-center justify-center">
            <Radio size={15} className="text-teal-500" />
          </div>
          <p className="text-sm font-semibold text-text-primary flex-1">Channels</p>
          <span className="text-[10px] text-text-secondary font-medium bg-bg-secondary px-2 py-0.5 rounded-full">
            {connectedCount}/{channels.length} connected
          </span>
          <Link href="/channels" className="ml-1 flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent">
            All <ArrowUpRight size={11} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (<div key={i} className="h-10 bg-bg-secondary rounded-xl animate-pulse" />))}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-text-secondary text-sm py-6 text-center">No channels yet</p>
        ) : (
          <div className="space-y-1">
            {channels.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors group"
              >
                {c.is_connected
                  ? <CircleCheck size={14} className="text-emerald-500 shrink-0" />
                  : <CircleAlert size={14} className="text-red-500 shrink-0" />
                }
                <span className="text-sm font-medium text-text-primary truncate flex-1">{c.name}</span>
                <span className="text-[10px] uppercase tracking-wide font-bold text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded shrink-0">
                  {c.type}
                </span>
                {c.agent_name && (
                  <span className="hidden sm:inline text-[11px] text-text-secondary truncate max-w-[120px]">
                    {c.agent_name}
                  </span>
                )}
                <span className="text-[11px] text-text-secondary tabular-nums shrink-0">{timeAgo(c.last_message_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Agents */}
      <div className="bg-card-bg border border-border-color rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center">
            <Bot size={15} className="text-purple-500" />
          </div>
          <p className="text-sm font-semibold text-text-primary flex-1">AI Agents</p>
          <span className="text-[10px] text-text-secondary font-medium bg-bg-secondary px-2 py-0.5 rounded-full">
            {agents.by_status.active ?? 0} active · {agents.total} total
          </span>
          <Link href="/agents" className="ml-1 flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent">
            All <ArrowUpRight size={11} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (<div key={i} className="h-10 bg-bg-secondary rounded-xl animate-pulse" />))}
          </div>
        ) : agents.recent.length === 0 ? (
          <p className="text-text-secondary text-sm py-6 text-center">No agents yet</p>
        ) : (
          <div className="space-y-1">
            {agents.recent.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors group"
              >
                <span className="text-sm font-medium text-text-primary truncate flex-1">{a.name}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${STATUS_CLS[a.status] ?? STATUS_CLS.draft}`}>
                  {a.status}
                </span>
                <span className="text-[11px] text-text-secondary tabular-nums shrink-0">
                  {a.total_runs} runs · {timeAgo(a.last_run_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
