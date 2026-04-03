'use client';

/**
 * React Query wrapper for dashboard stats.
 *
 * Replaces the manual useEffect + useState pattern in use-dashboard-stats.ts
 * with automatic caching, deduplication, and background refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { getLeadStats, type LeadStats } from '@/services/customers';
import { listAgents } from '@/services/agents';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export interface DashboardStats {
  totalLeads: number;
  activeCustomers: number;
  agentSessions: number;
  conversionRate: number;
}

export interface RecentActivityItem {
  label: string;
  time: string;
}

export interface DashboardInsights {
  summary: string;
  topSource?: string;
  statusBreakdown?: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivityItem[];
  insights: DashboardInsights | null;
  leadStatsError: string | null;
}

async function fetchDashboardData(lmsEnabled: boolean): Promise<DashboardData> {
  const [leadResult, convos, agents] = await Promise.all([
    lmsEnabled
      ? getLeadStats()
          .then((data) => ({ data, error: null as string | null }))
          .catch((err: unknown) => ({
            data: null as LeadStats | null,
            error: err instanceof Error ? err.message : 'Failed to load lead stats',
          }))
      : Promise.resolve({ data: null as LeadStats | null, error: 'LMS_DISABLED' as string | null }),
    apiFetch<Array<{ id: number; summary?: string | null; last_message_at?: string | null; lead_name?: string | null }>>(
      '/convo/',
      { method: 'GET' },
    ).catch(() => []),
    listAgents().catch(() => []),
  ]);

  const { data: leadStats, error: leadError } = leadResult;
  const totalLeads = leadStats?.total_leads ?? 0;
  const won = leadStats?.by_stage?.won ?? 0;
  const conversionRate = totalLeads > 0 ? (won / totalLeads) * 100 : 0;
  const convoList = Array.isArray(convos) ? convos : [];

  const stats: DashboardStats = {
    totalLeads,
    activeCustomers: totalLeads,
    agentSessions: convoList.length,
    conversionRate,
  };

  const recent = convoList
    .slice(0, 5)
    .sort((a, b) => {
      const ta = a.last_message_at ?? '';
      const tb = b.last_message_at ?? '';
      return new Date(tb).getTime() - new Date(ta).getTime();
    })
    .map((c) => ({
      label: c.summary || `Conversation with ${(c as Record<string, unknown>).lead_name ?? 'customer'}`,
      time: formatRelative(c.last_message_at),
    }));

  const recentActivity = recent.length ? recent : [{ label: 'No recent activity', time: '—' }];
  const insights = leadStats ? buildInsights(leadStats) : null;
  const leadStatsError = leadError === 'LMS_DISABLED' ? 'Enable LMS to see lead metrics' : leadError;

  return { stats, recentActivity, insights, leadStatsError };
}

export function useDashboardQuery(options?: { lmsEnabled?: boolean }) {
  const lmsEnabled = options?.lmsEnabled !== false;

  return useQuery({
    queryKey: queryKeys.dashboardStats(lmsEnabled),
    queryFn: () => fetchDashboardData(lmsEnabled),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return 'Today';
  if (diff < 86400_000) return 'Yesterday';
  if (diff < 604800_000) return 'This week';
  return d.toLocaleDateString();
}

function buildInsights(leadStats: LeadStats): DashboardInsights {
  const total = leadStats.total_leads ?? 0;
  const won = leadStats.by_stage?.won ?? 0;
  const conversion = total > 0 ? (won / total) * 100 : 0;

  const summary =
    total === 0
      ? 'No leads yet. Create leads to start tracking performance.'
      : `${won} won out of ${total} leads (${conversion.toFixed(1)}% conversion).`;

  let topSource: string | undefined;
  const sources = leadStats.by_source ?? {};
  const sourceEntries = Object.entries(sources);
  if (sourceEntries.length) {
    const [name] = sourceEntries.reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      sourceEntries[0],
    );
    topSource = `Top source: ${name}.`;
  }

  const byStage = leadStats.by_stage ?? {};
  const stageEntries = Object.entries(byStage);
  const stageParts: string[] = stageEntries
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);
  const statusBreakdown = stageParts.length ? `Pipeline: ${stageParts.join(', ')}.` : undefined;

  return { summary, topSource, statusBreakdown };
}
