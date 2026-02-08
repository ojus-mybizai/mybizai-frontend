'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { ToolRow } from '@/components/agents/tool-row';
import { useAgentStore } from '@/lib/agent-store';
import { useToolStore } from '@/lib/tool-store';

export default function AgentToolsPage() {
  const { current, loading: agentLoading, saveTools } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
    saveTools: s.saveTools,
  }));
  const { tools, loading: toolLoading, list: listTools } = useToolStore((s) => ({
    tools: s.tools,
    loading: s.loading,
    list: s.list,
  }));

  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void listTools();
  }, [listTools]);

  useEffect(() => {
    if (current) {
      setSelection(current.toolIds);
    }
  }, [current]);

  const disabled = useMemo(() => current?.status === 'active', [current?.status]);

  if ((agentLoading || toolLoading) && !current) {
    return <LoadingSkeleton count={3} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  const handleToggle = (id: string, next: boolean) => {
    setSelection((prev) => (next ? [...new Set([...prev, id])] : prev.filter((t) => t !== id)));
  };

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setMessage(null);
    await saveTools(current.id, selection);
    setSaving(false);
    setMessage('Saved');
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      {tools.length === 0 && !toolLoading ? (
        <div className="rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-base font-semibold text-text-primary">No tools available</div>
          <p className="mt-1 text-sm text-text-secondary">
            You can keep going without tools, or manage tools in{' '}
            <Link href="/settings" className="font-semibold text-accent hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              enabled={selection.includes(tool.id)}
              onToggle={handleToggle}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || disabled}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {disabled ? 'Active - lock' : saving ? 'Saving…' : 'Save'}
        </button>
        {disabled && <div className="text-xs text-text-secondary">Pause the agent to edit tools.</div>}
      </div>
    </div>
  );
}
