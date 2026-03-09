'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import { DeployButton } from '@/components/agents/deploy-button';
import { EmptyState } from '@/components/agents/empty-state';
import { useAgentStore } from '@/lib/agent-store';

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'channels', label: 'Channels' },
  { slug: 'tools', label: 'Tools' },
  { slug: 'follow-ups', label: 'Follow-ups' },
  { slug: 'knowledge-base', label: 'Knowledge Base' },
  { slug: 'analytics', label: 'Analytics' },
  { slug: 'test', label: 'Test' },
];

export default function AgentLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ agentId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { current, loading, select, setStatus } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
    select: s.select,
    setStatus: s.setStatus,
  }));

  useEffect(() => {
    if (params?.agentId) {
      void select(params.agentId);
    }
  }, [params?.agentId, select]);

  if (!current && loading) {
    return (
      <ModuleGuard module="agents">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-bg-secondary" />
          <div className="h-10 w-full animate-pulse rounded bg-bg-secondary" />
        </div>
      </ModuleGuard>
    );
  }

  if (!current) {
    return (
      <ModuleGuard module="agents">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Agent not found"
            description="Please return to the agent list and re-open."
            actionLabel="Go to agents"
            onAction={() => router.push('/agents')}
          />
        </div>
      </ModuleGuard>
    );
  }

  const base = `/agents/${current.id}`;
  const activeTab = tabs.find((t) => pathname?.startsWith(`${base}/${t.slug}`));
  const setupRecommended = (current.channelIds?.length ?? 0) === 0;

  return (
    <ModuleGuard module="agents">
        <div className="mx-auto max-w-6xl space-y-5">
          <nav className="text-xs text-text-secondary">
            <Link href="/agents" className="font-semibold text-accent hover:underline">
              Agents
            </Link>
            <span className="mx-2 text-text-secondary/70">/</span>
            <span className="text-text-primary">{current.name}</span>
            {activeTab?.label && (
              <>
                <span className="mx-2 text-text-secondary/70">/</span>
                <span>{activeTab.label}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col gap-3 rounded-2xl border border-border-color bg-card-bg p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{current.name}</h1>
                <AgentStatusBadge status={current.status} />
              </div>
              <div className="text-sm text-text-secondary capitalize">{current.role} agent</div>
            </div>
            <DeployButton
              status={current.status}
              onChange={async (next) => {
                await setStatus(current.id, next);
              }}
            />
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border-color bg-bg-primary px-1 py-1 text-sm">
            {tabs.map((tab) => {
              const href = `${base}/${tab.slug}`;
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={tab.slug}
                  href={href}
                  className={`rounded-lg px-3 py-2 font-semibold transition ${
                    active ? 'bg-card-bg text-text-primary border border-border-color' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tab.label}
                    {tab.slug === 'channels' && setupRecommended && (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Setup recommended"
                        aria-label="Setup recommended"
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          <div>{children}</div>
        </div>
    </ModuleGuard>
  );
}
