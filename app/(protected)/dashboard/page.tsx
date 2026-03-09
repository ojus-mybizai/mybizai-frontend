'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardMessage } from '@/components/dashboard/types';
import type { DatasheetScopeOption } from '@/components/dashboard/floating-chat-input';
import ViewToggle from '@/components/dashboard/view-toggle';
import MetricsView from '@/components/dashboard/metrics-view';
import ChatView from '@/components/dashboard/chat-view';
import FloatingChatInput from '@/components/dashboard/floating-chat-input';
import { useAuthStore } from '@/lib/auth-store';
import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { useReportsDashboard } from '@/lib/use-reports-dashboard';
import { sendDashboardChat } from '@/services/dashboard';
import { listModels } from '@/services/dynamic-data';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user as { businesses?: Array<{ lms_enabled?: boolean; agents_enabled?: boolean }> } | null);
  const business = user?.businesses?.[0];
  const lmsEnabled = business?.lms_enabled !== false;
  const agentsEnabled = business?.agents_enabled !== false;
  const { stats, recentActivity, insights, leadStatsError, loading: statsLoading } = useDashboardStats({ lmsEnabled });
  const { data: reportsDashboard, loading: reportsLoading, error: reportsError } = useReportsDashboard(30);
  const [view, setView] = useState<'metrics' | 'chat'>('metrics');
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [datasheetModels, setDatasheetModels] = useState<Awaited<ReturnType<typeof listModels>>>([]);

  useEffect(() => {
    if (view === 'chat') {
      listModels()
        .then(setDatasheetModels)
        .catch(() => setDatasheetModels([]));
    }
  }, [view]);

  const datasheetScopeOptions: DatasheetScopeOption[] = datasheetModels.map((m) => ({
    mention: `@datasheet-${m.id}`,
    model: `datasheet-${m.id}`,
    label: `Data: ${m.display_name}`,
    dynamicModelId: m.id,
  }));

  const handleSend = async (message?: string, attachments?: File[]) => {
    const trimmed = (message ?? inputValue).trim();
    if (!trimmed && (!attachments || attachments.length === 0) || isLoading) return;

    const displayContent = trimmed || (attachments?.length ? `[${attachments.length} attachment(s)]` : '');
    const userMessage: DashboardMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setView('chat');
    setIsLoading(true);

    const datasheetMatch = trimmed.match(/@datasheet-(\d+)/);
    const activeDatasheetId =
      datasheetMatch != null ? parseInt(datasheetMatch[1], 10) : undefined;

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await sendDashboardChat(
        trimmed || ' ',
        history,
        attachments,
        activeDatasheetId
      );

      const aiMessage: DashboardMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const aiMessage: DashboardMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: (err as Error).message || 'Failed to get a response. Please try again.',
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl space-y-4 pb-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Dashboard</h2>
              <p className="mt-1 text-base text-text-secondary">
                See what&apos;s happening across customers, orders, tasks, and your team.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle view={view} onChange={setView} />
              {view === 'chat' && (
                <span className="text-sm text-text-secondary">
                  Type @ to scope
                </span>
              )}
            </div>
          </div>

          {(lmsEnabled || agentsEnabled) && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/catalog"
                className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
              >
                Catalog &amp; Stock
              </Link>
              <Link
                href="/orders"
                className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
              >
                Orders &amp; Bookings
              </Link>
              {lmsEnabled && (
                <>
                  <Link
                    href="/customers"
                    className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                  >
                    Customers
                  </Link>
                  <Link
                    href="/conversations"
                    className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                  >
                    Conversations
                  </Link>
                  <Link
                    href="/channels"
                    className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                  >
                    Channels
                  </Link>
                </>
              )}
              {agentsEnabled && (
                <Link
                  href="/agents"
                  className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                >
                  Business Agents
                </Link>
              )}
            </div>
          )}

          {view === 'metrics' ? (
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
          ) : (
            <ChatView messages={messages} isLoading={isLoading} />
          )}

          <FloatingChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={(msg, files) => handleSend(msg, files)}
            isLoading={isLoading}
            datasheetScopes={datasheetScopeOptions}
          />
        </div>
  );
}
