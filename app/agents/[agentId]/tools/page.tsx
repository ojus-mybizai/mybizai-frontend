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

  const [selectionByAgent, setSelectionByAgent] = useState<Record<string, string[]>>({});
  const [toolRulesByAgent, setToolRulesByAgent] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void listTools();
  }, [listTools]);

  const disabled = useMemo(() => current?.status === 'active', [current?.status]);
  const realtimeTools = useMemo(
    () => tools.filter((t) => (t.executionMode ?? 'realtime') === 'realtime'),
    [tools],
  );
  const backgroundTools = useMemo(
    () => tools.filter((t) => (t.executionMode ?? 'realtime') === 'post_process'),
    [tools],
  );
  const batchTools = useMemo(
    () => tools.filter((t) => (t.executionMode ?? 'realtime') === 'batch'),
    [tools],
  );
  const selection = useMemo(() => {
    if (!current) return [];
    return selectionByAgent[current.id] ?? current.toolIds;
  }, [current, selectionByAgent]);
  const toolRules = useMemo(() => {
    if (!current) return {};
    if (toolRulesByAgent[current.id]) return toolRulesByAgent[current.id];
    const initialRules: Record<string, string> = {};
    for (const assignment of current.toolAssignments || []) {
      initialRules[assignment.toolId] = assignment.ruleText || '';
    }
    return initialRules;
  }, [current, toolRulesByAgent]);

  if ((agentLoading || toolLoading) && !current) {
    return <LoadingSkeleton count={3} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  const handleToggle = (id: string, next: boolean) => {
    if (!current) return;
    setSelectionByAgent((prev) => {
      const active = prev[current.id] ?? current.toolIds;
      const nextSelection = next ? [...new Set([...active, id])] : active.filter((t) => t !== id);
      return { ...prev, [current.id]: nextSelection };
    });
  };

  const handleRuleChange = (id: string, next: string) => {
    if (!current) return;
    setToolRulesByAgent((prev) => {
      const active = prev[current.id] ?? {};
      return { ...prev, [current.id]: { ...active, [id]: next } };
    });
  };

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setMessage(null);
    const toolConfigs = selection.reduce<Record<string, { rule_text?: string; enabled: boolean }>>((acc, toolId) => {
      const ruleText = (toolRules[toolId] || '').trim();
      acc[toolId] = {
        enabled: true,
        ...(ruleText ? { rule_text: ruleText } : {}),
      };
      return acc;
    }, {});
    await saveTools(current.id, selection, toolConfigs);
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
        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Realtime tools</h3>
            {realtimeTools.length === 0 ? (
              <div className="text-xs text-text-secondary">No realtime tools available.</div>
            ) : (
              realtimeTools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  enabled={selection.includes(tool.id)}
                  ruleText={toolRules[tool.id] || ''}
                  onRuleTextChange={handleRuleChange}
                  onToggle={handleToggle}
                  disabled={disabled}
                />
              ))
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Background tools</h3>
            {backgroundTools.length === 0 ? (
              <div className="text-xs text-text-secondary">No background tools available.</div>
            ) : (
              backgroundTools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  enabled={selection.includes(tool.id)}
                  ruleText={toolRules[tool.id] || ''}
                  onRuleTextChange={handleRuleChange}
                  onToggle={handleToggle}
                  disabled={disabled}
                />
              ))
            )}
          </div>

          {batchTools.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">Batch tools</h3>
              {batchTools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  enabled={selection.includes(tool.id)}
                  ruleText={toolRules[tool.id] || ''}
                  onRuleTextChange={handleRuleChange}
                  onToggle={handleToggle}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
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
