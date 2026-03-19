'use client';

import { useCallback, useEffect, useState } from 'react';
import MetricsView from '@/components/dashboard/metrics-view';
import { PinnedReportsSection } from '@/components/dashboard/pinned-reports-section';
import AIChatPanel from '@/components/dashboard/ai-chat-panel';
import { useAuthStore } from '@/lib/auth-store';
import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { useReportsDashboard } from '@/lib/use-reports-dashboard';
import {
  getManagerStatus,
  connectManager,
  disconnectManager,
  regenerateWebhookToken,
  type ManagerStatus,
} from '@/services/dashboard';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

type Tab = 'chat' | 'metrics';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-bg-secondary p-0.5">
      {([
        { id: 'chat',    label: 'AI Chat'  },
        { id: 'metrics', label: 'Metrics'  },
      ] as { id: Tab; label: string }[]).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
            active === t.id
              ? 'bg-card-bg text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore(
    (s) => s.user as { businesses?: Array<{ lms_enabled?: boolean }> } | null,
  );
  const lmsEnabled = user?.businesses?.[0]?.lms_enabled !== false;

  const { stats, recentActivity, insights, leadStatsError, loading: statsLoading } =
    useDashboardStats({ lmsEnabled });
  const { data: reportsDashboard, loading: reportsLoading, error: reportsError } =
    useReportsDashboard(30);

  const [activeTab, setActiveTab]           = useState<Tab>('chat');
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [managerStatus, setManagerStatus]   = useState<ManagerStatus | null>(null);
  const [managerLoading, setManagerLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setManagerLoading(true);
    try { setManagerStatus(await getManagerStatus()); }
    catch { /* non-fatal */ }
    finally { setManagerLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleConnect = async () => {
    setManagerLoading(true);
    try { setManagerStatus(await connectManager()); }
    finally { setManagerLoading(false); }
  };

  const handleDisconnect = async () => {
    setManagerLoading(true);
    try {
      await disconnectManager();
      setManagerStatus((p) => p ? { ...p, is_connected: false } : p);
    } finally { setManagerLoading(false); }
  };

  const handleRegenerateToken = async () => {
    try {
      const { webhook_token } = await regenerateWebhookToken();
      setManagerStatus((p) => p ? { ...p, webhook_token } : p);
    } catch { /* silent */ }
  };

  return (
    <div className="flex h-full flex-col gap-3">

      {/* ── Minimal top bar ── */}
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold text-text-secondary tracking-wide uppercase">
          Dashboard
        </h2>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Chat (primary tab) ── */}
      {activeTab === 'chat' && (
        <div className="flex flex-1 min-h-0">
          <AIChatPanel
            className="flex-1 min-h-0"
            isFullscreen={chatFullscreen}
            onToggleFullscreen={() => setChatFullscreen((v) => !v)}
            managerStatus={managerStatus}
            managerLoading={managerLoading}
            apiBase={API_BASE}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRegenerateToken={handleRegenerateToken}
          />
        </div>
      )}

      {/* ── Metrics tab ── */}
      {activeTab === 'metrics' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">
          <MetricsView
            stats={stats}
            recentActivity={recentActivity}
            insights={insights}
            leadStatsError={leadStatsError}
            loading={statsLoading}
            reportsDashboard={reportsDashboard}
            reportsLoading={reportsLoading}
            reportsError={reportsError}
          />
          <PinnedReportsSection />
        </div>
      )}
    </div>
  );
}
