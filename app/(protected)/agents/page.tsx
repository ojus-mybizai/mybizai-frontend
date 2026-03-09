'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import { DeployButton } from '@/components/agents/deploy-button';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { useAgentStore } from '@/lib/agent-store';
import { AgentStatus } from '@/services/agents';
import { AgentAnalyticsSummary, getAgentsByAgentSummary } from '@/services/analytics';

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AgentsPage() {
  const router = useRouter();
  const { agents, loading, list, setStatus } = useAgentStore((s) => ({
    agents: s.agents,
    loading: s.loading,
    list: s.list,
    setStatus: s.setStatus,
  }));

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'conversations' | 'resolution' | 'responseTime'>(
    'recent',
  );

  const [startDate, setStartDate] = useState(() =>
    formatDate(new Date(Date.now() - 30 * 86400000)),
  );
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [appliedStartDate, setAppliedStartDate] = useState(() =>
    formatDate(new Date(Date.now() - 30 * 86400000)),
  );
  const [appliedEndDate, setAppliedEndDate] = useState(() => formatDate(new Date()));
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [agentSummaries, setAgentSummaries] = useState<Record<string, AgentAnalyticsSummary>>({});

  useEffect(() => {
    void list();
  }, [list]);

  const fetchAnalytics = useCallback(async () => {
    if (!agents.length) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const ids = agents
        .map((a) => Number(a.id))
        .filter((id) => !Number.isNaN(id) && Number.isFinite(id));
      const res = await getAgentsByAgentSummary({
        start_date: `${appliedStartDate}T00:00:00`,
        end_date: `${appliedEndDate}T23:59:59`,
        agent_ids: ids.length ? ids : undefined,
      });
      const map: Record<string, AgentAnalyticsSummary> = {};
      res.forEach((row) => {
        map[String(row.agent_id)] = row;
      });
      setAgentSummaries(map);
    } catch (e) {
      setAnalyticsError((e as Error).message ?? 'Failed to load agent analytics');
      setAgentSummaries({});
    } finally {
      setAnalyticsLoading(false);
    }
  }, [agents, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const applyDateRange = async () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    await fetchAnalytics();
  };

  const applyPresetDays = async (days: number) => {
    const nextStart = formatDate(new Date(Date.now() - days * 86400000));
    const nextEnd = formatDate(new Date());
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setAppliedStartDate(nextStart);
    setAppliedEndDate(nextEnd);
    await fetchAnalytics();
  };

  const filteredAgents = useMemo(() => {
    let base = [...agents];
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') {
      base = base.filter((a) => a.status === statusFilter);
    }

    base.sort((a, b) => {
      const sa = agentSummaries[a.id];
      const sb = agentSummaries[b.id];
      if (sortBy === 'conversations') {
        const va = sa?.total_conversations ?? 0;
        const vb = sb?.total_conversations ?? 0;
        return vb - va;
      }
      if (sortBy === 'resolution') {
        const va = sa?.resolution_rate ?? 0;
        const vb = sb?.resolution_rate ?? 0;
        return vb - va;
      }
      if (sortBy === 'responseTime') {
        const va = sa?.avg_response_time ?? Number.POSITIVE_INFINITY;
        const vb = sb?.avg_response_time ?? Number.POSITIVE_INFINITY;
        return va - vb;
      }
      // recent (default): createdAt desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return base;
  }, [agents, search, statusFilter, sortBy, agentSummaries]);

  const aggregate = useMemo(() => {
    if (!filteredAgents.length) return null;
    const summaries = filteredAgents
      .map((a) => agentSummaries[a.id])
      .filter(Boolean) as AgentAnalyticsSummary[];
    if (!summaries.length) {
      return {
        totalAgents: filteredAgents.length,
        totalConversations: 0,
        avgResponseTime: 0,
        resolutionRate: 0,
      };
    }
    const totalConversations = summaries.reduce(
      (sum, s) => sum + (s.total_conversations ?? 0),
      0,
    );
    const avgResponseTime =
      summaries.reduce((sum, s) => sum + (s.avg_response_time ?? 0), 0) /
      summaries.length;
    const resolutionRate =
      summaries.reduce((sum, s) => sum + (s.resolution_rate ?? 0), 0) /
      summaries.length;
    return {
      totalAgents: filteredAgents.length,
      totalConversations,
      avgResponseTime,
      resolutionRate,
    };
  }, [filteredAgents, agentSummaries]);

  return (
    <ModuleGuard module="agents">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
                Business Agents
              </h1>
              <p className="text-sm text-text-secondary">
                Configure and monitor the AI agents that handle conversations for your business.
              </p>
              <p className="text-xs text-text-secondary">
                Performance metrics on this page use the selected date range below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/agents/new')}
              className="inline-flex items-center rounded-md bg-accent px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Create business agent
            </button>
          </div>

          {loading && <LoadingSkeleton count={6} />}

          {!loading && filteredAgents.length === 0 && (
            <EmptyState
              title="No agents yet"
              description="Create your first agent to start configuring channels, tools, and KB."
              actionLabel="Create agent"
              onAction={() => router.push('/agents/new')}
            />
          )}

          {!loading && filteredAgents.length > 0 && (
            <div className="space-y-5">
              {/* Summary strip */}
              {aggregate && (
                <div className="space-y-1 rounded-2xl border border-border-color bg-card-bg p-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-secondary">Agents</div>
                      <div className="text-xl font-semibold text-text-primary">
                        {aggregate.totalAgents}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-secondary">
                        Conversations (range)
                      </div>
                      <div className="text-xl font-semibold text-text-primary">
                        {aggregate.totalConversations.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-secondary">
                        Avg response time
                      </div>
                      <div className="text-xl font-semibold text-text-primary">
                        {aggregate.avgResponseTime.toFixed(1)}s
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-secondary">
                        Avg resolution rate
                      </div>
                      <div className="text-xl font-semibold text-text-primary">
                        {aggregate.resolutionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-text-secondary">
                    For {appliedStartDate} to {appliedEndDate}
                  </div>
                </div>
              )}

              {/* Controls row */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border-color bg-card-bg p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    type="search"
                    placeholder="Search by name, role, or model…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-xs flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="recent">Newest first</option>
                    <option value="conversations">Most conversations</option>
                    <option value="resolution">Best resolution rate</option>
                    <option value="responseTime">Fastest response</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void applyPresetDays(7)}
                    disabled={analyticsLoading}
                    className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-60"
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyPresetDays(30)}
                    disabled={analyticsLoading}
                    className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-60"
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyPresetDays(90)}
                    disabled={analyticsLoading}
                    className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-60"
                  >
                    Last 90 days
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                    />
                    <span className="text-text-secondary">–</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void applyDateRange()}
                      disabled={analyticsLoading}
                      className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {analyticsLoading ? 'Loading…' : 'Apply'}
                    </button>
                  </div>
                </div>
              </div>

              {analyticsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {analyticsError}
                </div>
              )}
              {!analyticsLoading &&
                !analyticsError &&
                filteredAgents.length > 0 &&
                Object.keys(agentSummaries).length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    No agent analytics rows found for this range yet. Open an agent analytics page and
                    use <span className="font-semibold">Recalculate now</span> to backfill from sessions.
                  </div>
                )}

              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>
                  {filteredAgents.length} agent
                  {filteredAgents.length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <span>
                    Showing {appliedStartDate} to {appliedEndDate}
                  </span>
                  <Link
                    href="/agents/templates"
                    className="font-semibold text-accent hover:underline"
                  >
                    Message templates
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAgents.map((agent) => {
                  const summary = agentSummaries[agent.id];
                  return (
                  <div
                    key={agent.id}
                    className="rounded-2xl border border-border-color bg-card-bg p-5 transition hover:border-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/agents/${agent.id}/overview`}
                          className="block text-base font-semibold text-text-primary hover:underline line-clamp-1"
                        >
                          {agent.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                          <span className="capitalize">{agent.role} agent</span>
                          <span className="text-text-secondary/70">·</span>
                          <span className="truncate">Model {agent.model}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <AgentStatusBadge status={agent.status} />
                        <span className="text-[11px] text-text-secondary">
                          {agent.deployed ? 'Deployed' : 'Not deployed'}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-text-secondary whitespace-pre-line line-clamp-3">
                      {agent.instructions || 'No instructions yet.'}
                    </p>

                    {/* Configuration mini-summary */}
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-secondary">
                      <span className="inline-flex items-center rounded-full bg-bg-primary px-2 py-1">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-accent" />
                        {agent.channelIds.length} channel
                        {agent.channelIds.length === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-bg-primary px-2 py-1">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-accent" />
                        {agent.toolIds.length} tool
                        {agent.toolIds.length === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-bg-primary px-2 py-1">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-accent" />
                        {agent.kbIds.length} KB source
                        {agent.kbIds.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Performance metrics */}
                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-lg border border-border-color bg-bg-primary p-3">
                        <div className="mb-1 text-[11px] text-text-secondary">
                          Conversations (range)
                        </div>
                        <div className="text-sm font-semibold text-text-primary">
                          {summary ? summary.total_conversations.toLocaleString() : '–'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border-color bg-bg-primary p-3">
                        <div className="mb-1 text-[11px] text-text-secondary">
                          Resolution rate
                        </div>
                        <div className="text-sm font-semibold text-text-primary">
                          {summary ? `${summary.resolution_rate.toFixed(1)}%` : '–'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border-color bg-bg-primary p-3">
                        <div className="mb-1 text-[11px] text-text-secondary">
                          Avg response time
                        </div>
                        <div className="text-sm font-semibold text-text-primary">
                          {summary ? `${summary.avg_response_time.toFixed(1)}s` : '–'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/agents/${agent.id}/overview`)}
                        className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                      >
                        Open
                      </button>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/agents/${agent.id}/analytics`}
                          className="text-sm font-semibold text-accent hover:underline"
                        >
                          Analytics
                        </Link>
                        <DeployButton
                          status={agent.status}
                          onChange={async (next) => {
                            await setStatus(agent.id, next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
    </ModuleGuard>
  );
}
