'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import { DeployButton } from '@/components/agents/deploy-button';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { useDebounce } from '@/lib/use-debounce';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import type { AgentStatus, AgentTemplate } from '@/services/agents';
import { LayoutTemplate, Plus, ChevronDown, ChevronUp, Zap, MessageSquare, Trash2 } from 'lucide-react';

// ─── Template Card ───────────────────────────────────────────

const TemplateCard = memo(function TemplateCard({ t, onUse }: { t: AgentTemplate; onUse: (t: AgentTemplate) => void }) {
  const cat: Record<string, string> = {
    sales: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    marketing: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
    operations: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
    general: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <button
      type="button"
      onClick={() => onUse(t)}
      className="text-left rounded-xl border border-border-color bg-card-bg p-4 hover:border-accent hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="text-sm font-semibold text-text-primary">{t.name}</h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cat[t.category] || cat.general}`}>
          {t.category}
        </span>
      </div>
      <p className="text-xs text-text-secondary line-clamp-2 mb-2">{t.description}</p>
      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
        <span>{t.skills.length} skills</span>
        <span>-</span>
        <span>{t.triggers.length > 0 ? `${t.triggers.length} trigger(s)` : t.schedule_cron ? 'Scheduled' : 'Manual'}</span>
      </div>
    </button>
  );
});

// ─── Agent Card ──────────────────────────────────────────────

const AgentCard = memo(function AgentCard({
  agent,
  onOpen,
  onDeploy,
  onDelete,
}: {
  agent: any;
  onOpen: () => void;
  onDeploy: (next: AgentStatus) => Promise<void>;
  onDelete: () => void;
}) {
  const chatOn = agent.chatEnabled !== false;
  const autoOn = agent.automationEnabled === true;

  return (
    <div
      className="rounded-xl border border-border-color bg-card-bg p-4 transition hover:border-accent cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{agent.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-text-secondary">
            <span className="capitalize">{agent.role}</span>
          </div>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 mb-3">
        {agent.instructions || 'No instructions yet.'}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
        {chatOn && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <MessageSquare className="w-3 h-3" /> Chat
          </span>
        )}
        {autoOn && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Zap className="w-3 h-3" /> Auto
          </span>
        )}
        {chatOn && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-text-secondary">
            {agent.channelIds?.length ?? 0} channels - {agent.skills?.length ?? 0} skills
          </span>
        )}
        {autoOn && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-text-secondary">
            {agent.skills?.length ?? 0} skills - {agent.totalRuns ?? 0} runs
          </span>
        )}
      </div>

      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete agent"
            className="rounded-lg border border-border-color p-1.5 text-text-secondary hover:border-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <DeployButton status={agent.status} onChange={onDeploy} />
      </div>
    </div>
  );
});

// ─── Main Page ───────────────────────────────────────────────

export default function AgentsClient() {
  const router = useRouter();
  // Split data (triggers re-renders) from actions (stable refs, no re-renders)
  const { agents, loading, templates } = useAgentStore(
    useShallow((s) => ({ agents: s.agents, loading: s.loading, templates: s.templates })),
  );
  const list = useAgentStore((s) => s.list);
  const setStatus = useAgentStore((s) => s.setStatus);
  const remove = useAgentStore((s) => s.remove);
  const loadTemplates = useAgentStore((s) => s.loadTemplates);
  const createFromTemplate = useAgentStore((s) => s.createFromTemplate);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    void list();
    void loadTemplates();
  }, [list, loadTemplates]);

  const filtered = useMemo(() => {
    let base = [...agents];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      base = base.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') base = base.filter((a) => a.status === statusFilter);
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [agents, debouncedSearch, statusFilter]);

  const handleUseTemplate = useCallback(
    async (t: AgentTemplate) => {
      try {
        const agent = await createFromTemplate(t.id);
        router.push(`/agents/${agent.id}/overview`);
      } catch { /* store handles error */ }
    },
    [createFromTemplate, router],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">AI Agents</h1>
            <p className="text-sm text-text-secondary mt-0.5">Create and manage AI agents for your business</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
            >
              <LayoutTemplate className="w-4 h-4" />
              Templates
              {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => router.push('/agents/builder')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 transition-colors"
            >
              <Zap className="w-4 h-4" /> Build with AI
            </button>
            <button
              type="button"
              onClick={() => router.push('/agents/new')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> New Agent
            </button>
          </div>
        </div>

        {/* Template Gallery */}
        {showTemplates && templates.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Start from a template</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.filter((t) => t.id !== 'custom').map((t) => (
                <TemplateCard key={t.id} t={t} onUse={handleUseTemplate} />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] max-w-xs rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {loading && <LoadingSkeleton count={4} />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            title="No agents yet"
            description="Create your first AI agent to start automating your business."
            actionLabel="Create Agent"
            onAction={() => router.push('/agents/new')}
          />
        )}

        {!loading && filtered.length > 0 && (
          <>
            <p className="text-xs text-text-secondary">{filtered.length} agent{filtered.length === 1 ? '' : 's'}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onOpen={() => router.push(`/agents/${agent.id}/overview`)}
                  onDeploy={async (next) => { await setStatus(agent.id, next); }}
                  onDelete={async () => {
                    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
                    await remove(agent.id);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
  );
}
