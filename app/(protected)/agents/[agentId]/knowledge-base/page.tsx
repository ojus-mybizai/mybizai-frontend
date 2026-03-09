'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/agents/empty-state';
import { KBRow } from '@/components/agents/kb-row';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { useAgentStore } from '@/lib/agent-store';
import { useKBStore } from '@/lib/kb-store';

export default function AgentKnowledgePage() {
  const { current, loading: agentLoading, saveKB } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
    saveKB: s.saveKB,
  }));
  const { items, loading: kbLoading, list: listKB } = useKBStore((s) => ({
    items: s.items,
    loading: s.loading,
    list: s.list,
  }));

  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void listKB();
  }, [listKB]);

  useEffect(() => {
    if (current) {
      setSelection(current.kbIds);
    }
  }, [current]);

  const disabled = useMemo(() => current?.status === 'active', [current?.status]);

  if ((agentLoading || kbLoading) && !current) {
    return <LoadingSkeleton count={3} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  const handleChange = (id: string, next: boolean) => {
    setSelection((prev) => (next ? [...new Set([...prev, id])] : prev.filter((k) => k !== id)));
  };

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setMessage(null);
    await saveKB(current.id, selection);
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

      {items.length === 0 && !kbLoading ? (
        <div className="rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-base font-semibold text-text-primary">No knowledge bases available</div>
          <p className="mt-1 text-sm text-text-secondary">
            You can proceed without knowledge grounding, or manage knowledge bases in{' '}
            <Link href="/settings" className="font-semibold text-accent hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((kb) => (
            <KBRow key={kb.id} kb={kb} checked={selection.includes(kb.id)} onChange={handleChange} disabled={disabled} />
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
        {disabled && <div className="text-xs text-text-secondary">Pause the agent to edit knowledge links.</div>}
      </div>
    </div>
  );
}
