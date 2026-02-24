'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { ToolRow } from '@/components/agents/tool-row';
import { DataSheetToolCard } from '@/components/agents/datasheet-tool-card';
import { CreateDataSheetToolModal } from '@/components/agents/create-datasheet-tool-modal';
import { useAgentStore } from '@/lib/agent-store';
import { useToolStore } from '@/lib/tool-store';
import { useDataSheetToolStore } from '@/lib/datasheet-tool-store';
import { listModels } from '@/services/dynamic-data';
import type { DataSheetToolOut } from '@/services/datasheet-tools';
import type { DynamicModel } from '@/services/dynamic-data';

export default function AgentToolsPage() {
  const params = useParams();
  const agentId = (params?.agentId as string) ?? '';

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
  const {
    tools: dsTools,
    loading: dsToolLoading,
    list: listDataSheetTools,
    remove: removeDataSheetTool,
  } = useDataSheetToolStore((s) => ({
    tools: s.tools,
    loading: s.loading,
    list: s.list,
    remove: s.remove,
  }));

  const [selectionByAgent, setSelectionByAgent] = useState<Record<string, string[]>>({});
  const [toolRulesByAgent, setToolRulesByAgent] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [systemToolsCollapsed, setSystemToolsCollapsed] = useState(false);
  const [systemToolSearch, setSystemToolSearch] = useState('');
  const [models, setModels] = useState<DynamicModel[]>([]);

  useEffect(() => {
    void listTools();
    void listDataSheetTools();
  }, [listTools, listDataSheetTools]);

  useEffect(() => {
    if (dsTools.length > 0) {
      listModels().then(setModels).catch(() => setModels([]));
    }
  }, [dsTools.length]);

  const disabled = useMemo(() => current?.status === 'active', [current?.status]);

  const systemToolsOnly = useMemo(
    () => tools.filter((t) => t.category !== 'datasheet'),
    [tools]
  );

  const filteredSystemTools = useMemo(() => {
    if (!systemToolSearch.trim()) return systemToolsOnly;
    const q = systemToolSearch.trim().toLowerCase();
    return systemToolsOnly.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    );
  }, [systemToolsOnly, systemToolSearch]);

  const selection = useMemo(() => {
    if (!current) return [];
    return selectionByAgent[current.id] ?? current.toolIds ?? [];
  }, [current, selectionByAgent]);

  const toolRules = useMemo(() => {
    if (!current) return {};
    if (toolRulesByAgent[current.id]) return toolRulesByAgent[current.id];
    const initialRules: Record<string, string> = {};
    for (const assignment of current.toolAssignments ?? []) {
      initialRules[assignment.toolId] = assignment.ruleText ?? '';
    }
    return initialRules;
  }, [current, toolRulesByAgent]);

  const modelDisplayNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of models) {
      map[m.id] = m.display_name || m.name;
    }
    return map;
  }, [models]);

  const hasUnsavedChanges = useMemo(() => {
    if (!current) return false;
    const currentSelection = selectionByAgent[current.id];
    const selectionChanged =
      currentSelection !== undefined &&
      (() => {
        const existing = new Set(current.toolIds ?? []);
        const next = new Set(currentSelection);
        if (existing.size !== next.size) return true;
        for (const id of next) {
          if (!existing.has(id)) return true;
        }
        return false;
      })();
    if (selectionChanged) return true;
    const currentRules = toolRulesByAgent[current.id];
    if (currentRules) {
      const initialRules: Record<string, string> = {};
      for (const a of current.toolAssignments ?? []) {
        initialRules[a.toolId] = a.ruleText ?? '';
      }
      const keys = new Set([...Object.keys(currentRules), ...Object.keys(initialRules)]);
      for (const k of keys) {
        if ((currentRules[k] ?? '').trim() !== (initialRules[k] ?? '').trim()) return true;
      }
    }
    return false;
  }, [current, selectionByAgent, toolRulesByAgent]);

  const handleToggle = useCallback(
    (id: string, next: boolean) => {
      if (!current) return;
      setSelectionByAgent((prev) => {
        const active = prev[current.id] ?? current.toolIds ?? [];
        const nextSelection = next
          ? [...new Set([...active, id])]
          : active.filter((t) => t !== id);
        return { ...prev, [current.id]: nextSelection };
      });
    },
    [current]
  );

  const handleRuleChange = useCallback(
    (id: string, next: string) => {
      if (!current) return;
      setToolRulesByAgent((prev) => {
        const existing = prev[current.id];
        const base: Record<string, string> = existing
          ? { ...existing }
          : (() => {
              const initial: Record<string, string> = {};
              for (const a of current.toolAssignments ?? []) {
                initial[a.toolId] = a.ruleText ?? '';
              }
              return initial;
            })();
        base[id] = next;
        return { ...prev, [current.id]: base };
      });
    },
    [current]
  );

  const handleDsToggle = useCallback(
    (toolId: number, next: boolean) => {
      handleToggle(String(toolId), next);
    },
    [handleToggle]
  );

  const handleDsRuleChange = useCallback(
    (toolId: number, next: string) => {
      handleRuleChange(String(toolId), next);
    },
    [handleRuleChange]
  );

  const handleDsDelete = useCallback(
    async (tool: DataSheetToolOut) => {
      await removeDataSheetTool(tool.id);
      if (current) {
        const nextSelection = (selectionByAgent[current.id] ?? current.toolIds ?? []).filter(
          (id) => id !== String(tool.id)
        );
        setSelectionByAgent((prev) => ({ ...prev, [current.id]: nextSelection }));
        const toolConfigs = nextSelection.reduce<
          Record<string, { rule_text?: string; enabled: boolean }>
        >((acc, toolId) => {
          acc[toolId] = {
            enabled: true,
            ...(toolRules[toolId]?.trim() ? { rule_text: toolRules[toolId] } : {}),
          };
          return acc;
        }, {});
        await saveTools(current.id, nextSelection, toolConfigs);
      }
    },
    [current, removeDataSheetTool, saveTools, selectionByAgent, toolRules]
  );

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setMessage(null);
    const toolConfigs = selection.reduce<
      Record<string, { rule_text?: string; enabled: boolean }>
    >((acc, toolId) => {
      const ruleText = (toolRules[toolId] ?? '').trim();
      acc[toolId] = {
        enabled: true,
        ...(ruleText ? { rule_text: ruleText } : {}),
      };
      return acc;
    }, {});
    await saveTools(current.id, selection, toolConfigs);
    setSaving(false);
    setMessage('Saved');
  }, [current, saveTools, selection, toolRules]);

  const handleCreated = useCallback(() => {
    void listDataSheetTools();
    if (current) {
      void useAgentStore.getState().select(current.id);
    }
  }, [current, listDataSheetTools]);

  if ((agentLoading || toolLoading) && !current) {
    return <LoadingSkeleton count={3} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-border-color bg-card-bg px-4 py-3 shadow-sm">
          <span className="text-sm text-text-secondary">You have unsaved changes.</span>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || disabled}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {disabled ? 'Pause agent to save' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Section 1: Data Sheet Tools */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">Data Sheet Tools</h2>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            disabled={disabled}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            + Create Data Sheet Tool
          </button>
        </div>

        {dsToolLoading && dsTools.length === 0 ? (
          <div className="rounded-2xl border border-border-color bg-card-bg p-6">
            <p className="text-sm text-text-secondary">Loading data sheet tools…</p>
          </div>
        ) : dsTools.length === 0 ? (
          <div className="rounded-2xl border border-border-color bg-card-bg p-6">
            <p className="text-base font-semibold text-text-primary">
              No data sheet tools yet
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Create one to let your AI read, search, or update your data sheets.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {dsTools.map((tool) => (
              <DataSheetToolCard
                key={tool.id}
                tool={tool}
                modelDisplayName={modelDisplayNames[tool.config.dynamic_model_id]}
                enabled={selection.includes(String(tool.id))}
                onToggle={handleDsToggle}
                ruleText={toolRules[String(tool.id)] ?? ''}
                onRuleTextChange={handleDsRuleChange}
                onDelete={handleDsDelete}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: System Tools */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setSystemToolsCollapsed((c) => !c)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-3 text-left"
        >
          <h2 className="text-base font-semibold text-text-primary">
            System Tools
            <span className="ml-2 rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
              {systemToolsOnly.length}
            </span>
          </h2>
          {systemToolsOnly.length >= 8 && (
            <input
              type="search"
              placeholder="Search…"
              value={systemToolSearch}
              onChange={(e) => setSystemToolSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-36 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          )}
          <span className="text-text-secondary" aria-hidden>
            {systemToolsCollapsed ? '▼' : '▲'}
          </span>
        </button>

        {!systemToolsCollapsed && (
          <>
            {filteredSystemTools.length === 0 ? (
              <div className="rounded-2xl border border-border-color bg-card-bg p-4">
                <p className="text-sm text-text-secondary">
                  {systemToolSearch
                    ? 'No system tools match your search.'
                    : 'No system tools available. Manage tools in Settings.'}
                </p>
                {!systemToolSearch && (
                  <Link
                    href="/settings"
                    className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                  >
                    Settings
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSystemTools.map((tool) => (
                  <ToolRow
                    key={tool.id}
                    tool={tool}
                    enabled={selection.includes(tool.id)}
                    ruleText={toolRules[tool.id] ?? ''}
                    onRuleTextChange={handleRuleChange}
                    onToggle={handleToggle}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {!hasUnsavedChanges && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || disabled}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {disabled ? 'Pause agent to edit tools' : saving ? 'Saving…' : 'Save'}
          </button>
          {disabled && (
            <span className="text-xs text-text-secondary">Pause the agent to edit tools.</span>
          )}
        </div>
      )}

      <CreateDataSheetToolModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
        agentId={agentId}
      />
    </div>
  );
}
