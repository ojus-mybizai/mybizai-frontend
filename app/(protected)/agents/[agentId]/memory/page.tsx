'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import { Check, Link2, Loader2 } from 'lucide-react';
import { useAgentStore } from '@/lib/agent-store';
import { useAgentMemory } from '@/lib/hooks/use-agent-memory';
import { attachMemory, detachMemory, type InjectionMode, type MemoryFileOut } from '@/services/agent-memory';
import MemoryList from '@/components/agent-memory/MemoryList';

/**
 * Per-agent Memory tab — attach/detach business memory files to this agent.
 * The frozen API has no per-agent attachment-state endpoint, so attachment
 * state is tracked optimistically for this session (attach/detach are
 * idempotent on the backend). Files marked "all agents" are auto-attached.
 */
export default function AgentMemoryTab() {
  const { current } = useAgentStore(useShallow((s) => ({ current: s.current })));
  const { data: items = [], isLoading } = useAgentMemory();
  const agentId = current ? Number(current.id) : null;

  // memoryId -> injection mode it's attached with (this session only).
  const [attached, setAttached] = useState<Record<number, InjectionMode>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const doAttach = async (m: MemoryFileOut, mode: InjectionMode) => {
    if (agentId == null) return;
    setBusy(m.id);
    try {
      await attachMemory(m.id, agentId, mode);
      setAttached((s) => ({ ...s, [m.id]: mode }));
    } finally {
      setBusy(null);
    }
  };

  const doDetach = async (m: MemoryFileOut) => {
    if (agentId == null) return;
    setBusy(m.id);
    try {
      await detachMemory(m.id, agentId);
      setAttached((s) => {
        const rest = { ...s };
        delete rest[m.id];
        return rest;
      });
    } finally {
      setBusy(null);
    }
  };

  const actions = (m: MemoryFileOut) => {
    if (m.attach_all_agents) {
      return <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Auto-attached</span>;
    }
    const isAttached = m.id in attached;
    const loading = busy === m.id;
    if (isAttached) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
            <Check className="h-3.5 w-3.5" /> {attached[m.id] === 'always' ? 'Always' : 'On demand'}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => void doDetach(m)}
            className="rounded-md border border-border-color px-2 py-1 text-xs text-text-secondary transition hover:border-red-400 hover:text-red-500 disabled:opacity-50"
          >
            Detach
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <select
          defaultValue="on_demand"
          id={`inj-${m.id}`}
          className="rounded-md border border-border-color bg-bg-primary px-1.5 py-1 text-xs text-text-primary"
        >
          <option value="on_demand">On demand</option>
          <option value="always">Always</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            const el = document.getElementById(`inj-${m.id}`) as HTMLSelectElement | null;
            void doAttach(m, (el?.value as InjectionMode) || 'on_demand');
          }}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Attach
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Memory</h2>
          <p className="text-xs text-text-secondary">Attach business memory files so this agent can use them.</p>
        </div>
        <Link href="/memory" className="text-sm font-medium text-accent hover:underline">
          Manage library →
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : (
        <MemoryList items={items} renderActions={actions} emptyText="No memory files yet. Create some in the Memory library." />
      )}
    </div>
  );
}
