'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import type { AgentTemplate, AgentRole } from '@/services/agents';
import { ArrowLeft, Loader2, Bot } from 'lucide-react';

export default function NewAgentPage() {
  const router = useRouter();
  const { create, templates, loadTemplates, createFromTemplate, loading, error } = useAgentStore(
    useShallow((s) => ({
      create: s.create,
      templates: s.templates,
      loadTemplates: s.loadTemplates,
      createFromTemplate: s.createFromTemplate,
      loading: s.loading,
      error: s.error,
    })),
  );

  const [name, setName] = useState('');
  const [role, setRole] = useState<AgentRole>('sales');
  const [instructions, setInstructions] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    try {
      const agent = await create({ name: name.trim(), role, tone: 'friendly' });
      // Update with additional fields after creation
      const { updateAgent } = await import('@/services/agents');
      await updateAgent(agent.id, {
        instructions: instructions.trim() || undefined,
        chatEnabled,
        automationEnabled,
      });
      router.push(`/agents/${agent.id}/overview`);
    } catch { /* store handles error */ }
  }, [name, role, instructions, chatEnabled, automationEnabled, create, router]);

  const handleTemplate = useCallback(
    async (t: AgentTemplate) => {
      try {
        const agent = await createFromTemplate(t.id);
        router.push(`/agents/${agent.id}/overview`);
      } catch { /* store handles error */ }
    },
    [createFromTemplate, router],
  );

  return (
    <PermissionGuard permission="manage_agents" module="agents">
      <div className="mx-auto max-w-2xl space-y-6 py-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/agents')} className="p-1.5 rounded-lg hover:bg-bg-secondary">
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Create AI Agent</h1>
            <p className="text-xs text-text-secondary">Start from a template or build from scratch</p>
          </div>
        </div>

        {/* Templates */}
        {templates.filter((t) => t.id !== 'custom').length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Start from a template</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.filter((t) => t.id !== 'custom').map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplate(t)}
                  disabled={loading}
                  className="text-left rounded-lg border border-border-color p-3 hover:border-accent transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-text-primary">{t.name}</span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border-color" />
          <span className="text-xs text-text-secondary">Or create from scratch</span>
          <div className="flex-1 border-t border-border-color" />
        </div>

        {/* Create Form */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-text-secondary">Agent name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Assistant"
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-xs font-medium text-text-secondary">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgentRole)}
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              >
                <option value="sales">Sales</option>
                <option value="support">Support</option>
                <option value="general">General</option>
                <option value="lead">Lead Generation</option>
              </select>
            </div>

            {/* Mode */}
            <div>
              <label className="text-xs font-medium text-text-secondary">Mode</label>
              <div className="mt-1.5 flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chatEnabled}
                    onChange={(e) => setChatEnabled(e.target.checked)}
                    className="rounded border-border-color"
                  />
                  <span className="text-sm text-text-primary">Chat</span>
                  <span className="text-[10px] text-text-secondary">(responds on channels)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={automationEnabled}
                    onChange={(e) => setAutomationEnabled(e.target.checked)}
                    className="rounded border-border-color"
                  />
                  <span className="text-sm text-text-primary">Automation</span>
                  <span className="text-[10px] text-text-secondary">(runs on triggers/schedules)</span>
                </label>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="text-xs font-medium text-text-secondary">Instructions</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                placeholder="Tell the agent what to do. Be specific about its behavior, what tools to use, and how to respond..."
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push('/agents')}
              className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Agent
            </button>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
