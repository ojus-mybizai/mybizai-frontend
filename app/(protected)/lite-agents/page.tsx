'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, Plus, Trash2, Radio } from 'lucide-react';
import { useLiteAgentStore } from '@/lib/lite-agent-store';
import { useShallow } from 'zustand/react/shallow';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

export default function LiteAgentsPage() {
  const { agents, loading, list, remove, setStatus } = useLiteAgentStore(
    useShallow((s) => ({
      agents: s.agents,
      loading: s.loading,
      list: s.list,
      remove: s.remove,
      setStatus: s.setStatus,
    })),
  );
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { list(); }, [list]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Lite Agent?')) return;
    setDeleting(id);
    await remove(id);
    setDeleting(null);
  };

  const handleToggle = async (id: string, current: string) => {
    await setStatus(id, current === 'active' ? 'paused' : 'active');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" /> Lite Agents
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Fast, single-call AI agents. One LLM call per message — no tools, no complexity.
          </p>
        </div>
        <Link
          href="/lite-agents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Create Lite Agent
        </Link>
      </div>

      {loading && agents.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border-color bg-card-bg" />
          ))}
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="h-12 w-12 text-text-secondary/40 mb-4" />
          <h3 className="text-lg font-semibold text-text-primary">No Lite Agents yet</h3>
          <p className="mt-1 text-sm text-text-secondary max-w-sm">
            Create a Lite Agent to auto-reply to customer messages with a single, fast AI call.
          </p>
          <Link
            href="/lite-agents/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Create Your First
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col justify-between rounded-xl border border-border-color bg-card-bg p-5 hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary truncate">{agent.name}</h3>
                <StatusBadge status={agent.status} />
              </div>
              <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                {agent.instructions || 'No instructions set'}
              </p>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Radio className="h-3 w-3" /> {agent.channelIds.length} channels
                </span>
                <span>{agent.totalRuns} runs</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-border-color pt-3">
              <Link
                href={`/lite-agents/${agent.id}/overview`}
                className="flex-1 rounded-lg border border-border-color px-3 py-1.5 text-center text-xs font-medium text-text-primary hover:bg-bg-secondary transition-colors"
              >
                Open
              </Link>
              <button
                onClick={() => handleToggle(agent.id, agent.status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  agent.status === 'active'
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}
              >
                {agent.status === 'active' ? 'Pause' : 'Deploy'}
              </button>
              <button
                onClick={() => handleDelete(agent.id)}
                disabled={deleting === agent.id}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-red-100 hover:text-red-600 transition-colors dark:hover:bg-red-900/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
