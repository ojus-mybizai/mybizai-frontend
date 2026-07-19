'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { getAgentAnalytics, recalculateAgentAnalytics } from '@/services/analytics';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useDateRangeStore, type DatePreset } from '@/lib/stores/date-range-store';

const AgentAnalyticsCharts = dynamic(
  () => import('@/components/agents/agent-analytics-charts'),
  { ssr: false }
);

export default function AgentAnalyticsPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params?.agentId ?? '';
  const { current } = useAgentStore(useShallow((s) => ({ current: s.current })));

  // This page uses a local controlled date range so changes don't affect other pages
  const globalStore = useDateRangeStore();
  const [localRange, setLocalRange] = useState({
    startDate: globalStore.startDate,
    endDate: globalStore.endDate,
    preset: globalStore.preset,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAgentAnalytics>> | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (start: string, end: string) => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAgentAnalytics(agentId, {
        start_date: `${start}T00:00:00`,
        end_date: `${end}T23:59:59`,
        group_by: 'day',
      });
      setData(Array.isArray(res) ? res : []);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void fetchAnalytics(localRange.startDate, localRange.endDate);
  }, [fetchAnalytics, localRange.startDate, localRange.endDate]);

  function handleRangeChange(start: string, end: string, preset: DatePreset) {
    setLocalRange({ startDate: start, endDate: end, preset });
  }

  const recalcNow = async () => {
    if (!agentId) return;
    setRecalcLoading(true);
    setRecalcMessage(null);
    try {
      const res = await recalculateAgentAnalytics(agentId, {
        start_date: `${localRange.startDate}T00:00:00`,
        end_date: `${localRange.endDate}T23:59:59`,
      });
      setRecalcMessage(`Recalculated ${res.processed_sessions ?? 0} sessions. Refreshing…`);
      await fetchAnalytics(localRange.startDate, localRange.endDate);
    } catch (e) {
      setRecalcMessage((e as Error).message ?? 'Failed to recalculate analytics.');
    } finally {
      setRecalcLoading(false);
    }
  };

  const aggregated = data?.length
    ? (() => {
        const n = data.length;
        const totalMessages      = data.reduce((s, r) => s + r.total_messages, 0);
        const totalConversations = data.reduce((s, r) => s + r.total_conversations, 0);
        const resolved           = data.reduce((s, r) => s + r.resolved_conversations, 0);
        const avgResponse        = data.reduce((s, r) => s + r.avg_response_time, 0) / Math.max(n, 1);
        const avgResolution      = data.reduce((s, r) => s + r.resolution_rate, 0) / Math.max(n, 1);
        return { totalMessages, totalConversations, resolved, avgResponse, avgResolution };
      })()
    : null;

  const chartData = useMemo(
    () => (data ?? []).map((row) => ({
      date: String(row.date).slice(5, 10),
      total_conversations: row.total_conversations,
      avg_response_time: row.avg_response_time,
    })),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Agent Analytics</h2>
          <p className="text-sm text-text-secondary">
            {current ? `Performance for ${current.name}` : `Agent #${agentId}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={localRange}
            onChange={handleRangeChange}
          />
          <button
            type="button"
            onClick={() => void recalcNow()}
            disabled={recalcLoading}
            className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-60"
          >
            {recalcLoading ? 'Recalculating…' : 'Recalculate now'}
          </button>
        </div>
      </div>

      {recalcMessage && (
        <div className="rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs text-text-secondary">
          {recalcMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-[84px] animate-pulse rounded-xl border border-border-color bg-card-bg" />
          ))}
        </div>
      )}

      {!loading && aggregated && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
            <div className="mb-1 text-xs font-medium text-text-secondary">Total conversations</div>
            <div className="text-xl font-semibold text-text-primary">{aggregated.totalConversations.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
            <div className="mb-1 text-xs font-medium text-text-secondary">Total messages</div>
            <div className="text-xl font-semibold text-text-primary">{aggregated.totalMessages.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
            <div className="mb-1 text-xs font-medium text-text-secondary">Avg response time</div>
            <div className="text-xl font-semibold text-text-primary">{aggregated.avgResponse.toFixed(1)}s</div>
          </div>
          <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
            <div className="mb-1 text-xs font-medium text-text-secondary">Resolution rate</div>
            <div className="text-xl font-semibold text-text-primary">{aggregated.avgResolution.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {!loading && data && data.length > 0 && (
        <>
          <AgentAnalyticsCharts chartData={chartData} />
          <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
            <h3 className="border-b border-border-color p-4 text-sm font-semibold text-text-primary">Daily breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Conversations</th>
                    <th className="px-4 py-3 text-left">Messages</th>
                    <th className="px-4 py-3 text-left">Avg response (s)</th>
                    <th className="px-4 py-3 text-left">Resolution %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {data.map((row) => (
                    <tr key={row.date}>
                      <td className="px-4 py-3 text-text-primary">{String(row.date).slice(0, 10)}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.total_conversations}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.total_messages}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.avg_response_time.toFixed(1)}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.resolution_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data?.length === 0 && !error && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-8 text-center text-sm text-text-secondary">
          No analytics data for this period yet. Click <strong>Recalculate now</strong> to backfill from sessions.
        </div>
      )}
    </div>
  );
}
