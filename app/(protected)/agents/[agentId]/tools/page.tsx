'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { useToolStore } from '@/lib/tool-store';
import { useDataSheetToolStore } from '@/lib/datasheet-tool-store';
import { CreateDataSheetToolModal } from '@/components/agents/create-datasheet-tool-modal';
import type { BindToolConfigInput } from '@/services/agents';
import { Save, Loader2, Plus, Search, Pencil, Trash2 } from 'lucide-react';

export default function ToolsPage() {
  const { current, saveTools } = useAgentStore(useShallow((s) => ({
    current: s.current,
    saveTools: s.saveTools,
  })));

  const { tools: systemTools, loading: sysLoading, list: loadSystemTools } = useToolStore();
  const { tools: dsTools, loading: dsLoading, list: loadDSTools, remove: removeDSTool } = useDataSheetToolStore();

  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [ruleTexts, setRuleTexts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    void loadSystemTools();
    void loadDSTools();
  }, []);

  // Populate from agent's current tool assignments
  useEffect(() => {
    if (!current) return;
    const ids = new Set((current.toolIds ?? []).map(String));
    setEnabledIds(ids);
    const rules: Record<string, string> = {};
    (current.toolAssignments ?? []).forEach((a) => {
      rules[String(a.toolId)] = a.ruleText || '';
    });
    setRuleTexts(rules);
  }, [current]);

  const toggleTool = (id: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setRule = (id: string, text: string) => {
    setRuleTexts((prev) => ({ ...prev, [id]: text }));
  };

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      const toolIds = Array.from(enabledIds);
      const configs: Record<string, BindToolConfigInput> = {};
      toolIds.forEach((id) => {
        if (ruleTexts[id]) configs[id] = { enabled: true, rule_text: ruleTexts[id] };
      });
      await saveTools(current.id, toolIds, configs);
      setNotice('Tools saved!');
      setTimeout(() => setNotice(null), 2000);
    } catch { /* store handles error */ } finally { setSaving(false); }
  }, [current, enabledIds, ruleTexts, saveTools]);

  if (!current) return null;

  const allTools = [
    ...systemTools.map((t) => ({ id: String(t.id), name: t.name, description: t.description || '', category: 'system' as const, execMode: (t as any).execution_mode ?? (t as any).executionMode })),
    ...dsTools.map((t: any) => ({ id: String(t.id), name: t.name || t.tool_name || `Datasheet #${t.id}`, description: t.trigger_instruction || t.description || '', category: 'datasheet' as const, execMode: 'realtime' })),
  ];

  const filtered = searchQuery.trim()
    ? allTools.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTools;

  const enabledCount = allTools.filter((t) => enabledIds.has(t.id)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* LEFT: Tool List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Tools</h2>
            <p className="text-xs text-text-secondary">Enable tools and set usage rules for this agent</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-secondary"
          >
            <Plus className="w-4 h-4" /> Add Datasheet Tool
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-color bg-bg-primary text-sm text-text-primary placeholder:text-text-secondary"
          />
        </div>

        {(sysLoading || dsLoading) && <div className="text-center py-8 text-sm text-text-secondary">Loading tools...</div>}

        {!sysLoading && !dsLoading && filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-text-secondary">No tools found.</div>
        )}

        {/* Tool List */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color">
            {filtered.map((tool) => {
              const on = enabledIds.has(tool.id);
              return (
                <div key={tool.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">{tool.name}</span>
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${tool.category === 'datasheet' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {tool.category === 'datasheet' ? 'Data Sheet' : 'System'}
                        </span>
                        {tool.execMode !== 'realtime' && (
                          <span className="text-[10px] text-text-secondary">{tool.execMode}</span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{tool.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tool.category === 'datasheet' && (
                        <>
                          <button
                            type="button"
                            title="Delete datasheet tool"
                            onClick={() => {
                              if (confirm(`Delete datasheet tool "${tool.name}"?`)) {
                                removeDSTool(Number(tool.id));
                                setEnabledIds((prev) => { const n = new Set(prev); n.delete(tool.id); return n; });
                              }
                            }}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          on
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'
                        }`}
                      >
                        {on ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                  {on && (
                    <input
                      type="text"
                      value={ruleTexts[tool.id] ?? ''}
                      onChange={(e) => setRule(tool.id, e.target.value)}
                      placeholder="When to use this tool (optional)"
                      className="mt-2 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Tools
        </button>
      </div>

      {/* RIGHT: Summary */}
      <div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Tools Summary</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-text-secondary">Enabled</span><span className="text-text-primary font-medium">{enabledCount} of {allTools.length}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">System</span><span className="text-text-primary">{systemTools.length}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Datasheet</span><span className="text-text-primary">{dsTools.length}</span></div>
          </div>
        </div>
      </div>

      {/* Create Datasheet Tool Modal */}
      {showCreateModal && (
        <CreateDataSheetToolModal
          agentId={String(current.id)}
          open={showCreateModal}
          onClose={() => { setShowCreateModal(false); }}
          onCreated={() => { setShowCreateModal(false); loadDSTools(); }}
        />
      )}
    </div>
  );
}
