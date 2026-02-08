'use client';

import { useEffect, useState } from 'react';
import { getLeadStats, type LeadStats } from '@/services/customers';
import { listAgents } from '@/services/agents';
import { apiFetch } from '@/lib/api-client';

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

export function useDashboardStats(options?: { lmsEnabled?: boolean }) {
  const lmsEnabled = options?.lmsEnabled !== false;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [leadStatsError, setLeadStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLeadStatsError(null);

    const leadStatsPromise = lmsEnabled
      ? getLeadStats()
          .then((data) => ({ data, error: null }))
          .catch((err: unknown) => ({
            data: null as LeadStats | null,
            error: err instanceof Error ? err.message : 'Failed to load lead stats',
          }))
      : Promise.resolve({
          data: null as LeadStats | null,
          error: 'LMS_DISABLED' as string | null,
        });

    Promise.all([
      leadStatsPromise,
      apiFetch<Array<{ id: number; summary?: string | null; last_message_at?: string | null; lead_name?: string | null }>>('/convo/', { method: 'GET' }).catch(() => []),
      listAgents().catch(() => []),
    ])
      .then(([leadResult, convos, agents]) => {
        if (cancelled) return;
        const { data: leadStats, error: leadError } = leadResult;
        if (leadError) {
          setLeadStatsError(leadError === 'LMS_DISABLED' ? 'Enable LMS to see lead metrics' : leadError);
        }
        const totalLeads = leadStats?.total_leads ?? 0;
        const won = leadStats?.by_status?.won ?? 0;
        const conversionRate = totalLeads > 0 ? (won / totalLeads) * 100 : 0;
        const convoList = Array.isArray(convos) ? convos : [];
        setStats({
          totalLeads,
          activeCustomers: totalLeads,
          agentSessions: convoList.length,
          conversionRate,
        });

        // Recent activity from conversations
        const recent = convoList
          .slice(0, 5)
          .sort((a, b) => {
            const ta = a.last_message_at ?? '';
            const tb = b.last_message_at ?? '';
            return new Date(tb).getTime() - new Date(ta).getTime();
          })
          .map((c) => ({
            label: c.summary || `Conversation with ${(c as any).lead_name ?? 'customer'}`,
            time: formatRelative(c.last_message_at),
          }));
        setRecentActivity(recent.length ? recent : [{ label: 'No recent activity', time: '—' }]);

        // Derive simple insights from lead stats
        if (leadStats) {
          setInsights(buildInsights(leadStats));
        } else {
          setInsights(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
          setLeadStatsError('Failed to load stats');
          setRecentActivity([{ label: 'Failed to load stats', time: '—' }]);
          setInsights(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lmsEnabled]);

  return { stats, recentActivity, insights, leadStatsError, loading };
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
  const won = leadStats.by_status?.won ?? 0;
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

  const byStatus = leadStats.by_status ?? {};
  const newCount = byStatus.new ?? 0;
  const contacted = byStatus.contacted ?? 0;
  const qualified = byStatus.qualified ?? 0;
  const statusParts: string[] = [];
  if (newCount) statusParts.push(`${newCount} new`);
  if (contacted) statusParts.push(`${contacted} contacted`);
  if (qualified) statusParts.push(`${qualified} qualified`);
  const statusBreakdown = statusParts.length ? `Pipeline: ${statusParts.join(', ')}.` : undefined;

  return {
    summary,
    topSource,
    statusBreakdown,
  };
}
