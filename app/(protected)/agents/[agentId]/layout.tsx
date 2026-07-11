'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Lock, Sparkles, Bot, MessageSquare, Zap } from 'lucide-react';
import ModuleGuard from '@/components/module-guard';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import { DeployButton } from '@/components/agents/deploy-button';
import { EmptyState } from '@/components/agents/empty-state';
import BuilderChatPanel from '@/components/agents/builder-chat/BuilderChatPanel';
import { useBuilderChatStore } from '@/lib/agent-builder-chat-store';
import { useAgentStore } from '@/lib/agent-store';
import { useAuthStore } from '@/lib/auth-store';
import { useShallow } from 'zustand/react/shallow';
import { getCurrentPlan } from '@/services/billing';

const allTabs = [
  { slug: 'overview',    label: 'Overview',    mode: 'always' as const },
  { slug: 'chat',        label: 'Chat',         mode: 'chat'   as const },
  { slug: 'automation',  label: 'Automation',   mode: 'auto'   as const },
  { slug: 'channels',    label: 'Channels',     mode: 'chat'   as const },
  { slug: 'skills',      label: 'Skills',       mode: 'always' as const },
  { slug: 'knowledge',   label: 'Knowledge',    mode: 'always' as const },
  { slug: 'memory',      label: 'Memory',       mode: 'always' as const },
  { slug: 'analytics',   label: 'Analytics',    mode: 'always' as const },
  { slug: 'test',        label: 'Test',         mode: 'chat'   as const },
];

// Tabs that require Growth+ plan (locked on Starter with upgrade badge)
const GROWTH_ONLY_TABS = new Set(['skills', 'knowledge', 'automation']);

export default function AgentLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ agentId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { current, loading, select, setStatus } = useAgentStore(useShallow((s) => ({
    current: s.current,
    loading: s.loading,
    select: s.select,
    setStatus: s.setStatus,
  })));

  // Builder chat panel open/close (persisted)
  const { panelOpen, setPanelOpen } = useBuilderChatStore(useShallow((s) => ({
    panelOpen: s.isOpen,
    setPanelOpen: s.setOpen,
  })));

  // Read plan from global store (cached across navigations — no flash)
  const { planSlug, planLoaded, setPlanSlug } = useAuthStore(useShallow((s) => ({
    planSlug: s.planSlug,
    planLoaded: s.planLoaded,
    setPlanSlug: s.setPlanSlug,
  })));

  // Fetch once per session, then it's cached in the store
  useEffect(() => {
    if (planLoaded) return; // already fetched
    getCurrentPlan()
      .then((p) => setPlanSlug(p.plan_slug || 'starter'))
      .catch(() => setPlanSlug('growth')); // fail open → full access
  }, [planLoaded, setPlanSlug]);

  const isStarterPlan = planLoaded && planSlug === 'starter';

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
  const chatOn = current.chatEnabled !== false;
  const autoOn = current.automationEnabled === true;
  const tabs = allTabs.filter(
    (t) => t.mode === 'always' || (t.mode === 'chat' && chatOn) || (t.mode === 'auto' && autoOn),
  );
  const activeTab = tabs.find((t) => pathname?.startsWith(`${base}/${t.slug}`));
  const setupRecommended = chatOn && (!current.channelIds || current.channelIds.length === 0);

  return (
    <ModuleGuard module="agents">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Full-width page header — breadcrumb spans the whole page */}
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

          {/* Below the header: workspace + AI panel side-by-side. The panel's
              top now aligns with the bottom of the breadcrumb header. */}
          <div className={panelOpen ? 'flex flex-col gap-5 md:flex-row md:items-start' : ''}>
          <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-border-color bg-card-bg p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Bot className="h-6 w-6" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-text-primary sm:text-2xl">{current.name}</h1>
                  <AgentStatusBadge status={current.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <span className="capitalize">{current.role} agent</span>
                  {chatOn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      <MessageSquare className="h-3 w-3" /> Chat
                    </span>
                  )}
                  {autoOn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Zap className="h-3 w-3" /> Automation
                    </span>
                  )}
                </div>
              </div>
            </div>
            <DeployButton
              status={current.status}
              onChange={async (next) => {
                await setStatus(current.id, next);
              }}
            />
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border-color bg-bg-secondary p-1 text-sm">
            {tabs.map((tab) => {
              const href = `${base}/${tab.slug}`;
              const active = pathname?.startsWith(href);
              const locked = isStarterPlan && GROWTH_ONLY_TABS.has(tab.slug);
              return (
                <Link
                  key={tab.slug}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-lg px-3.5 py-2 font-semibold transition ${
                    active
                      ? 'bg-card-bg text-text-primary shadow-sm'
                      : 'text-text-secondary hover:bg-card-bg/60 hover:text-text-primary'
                  } ${locked ? 'opacity-80' : ''}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tab.label}
                    {locked && (
                      <span title="Upgrade to Growth plan to unlock"><Lock className="h-3 w-3 text-amber-500" /></span>
                    )}
                    {tab.slug === 'channels' && setupRecommended && !locked && (
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

          <div>
            {/* If the active tab is locked on Starter plan, show upgrade overlay instead of content */}
            {isStarterPlan && activeTab && GROWTH_ONLY_TABS.has(activeTab.slug) ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/50 px-6 py-16 text-center">
                <div className="rounded-full bg-amber-100 p-3">
                  <Lock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {activeTab.label} requires Growth plan
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary max-w-md">
                    {activeTab.slug === 'skills' && 'Customize which skills your AI agent can use — product search, order creation, media sending, and more.'}
                    {activeTab.slug === 'knowledge' && 'Upload knowledge files so your AI agent can answer questions about your policies, pricing, and procedures.'}
                    {activeTab.slug === 'automation' && 'Set up automated triggers and workflows — schedule tasks, react to events, and automate lead management.'}
                  </p>
                </div>
                <Link
                  href="/settings/billing"
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Upgrade to Growth — Rs 2,999/mo
                </Link>
                <p className="text-xs text-text-secondary">
                  Your Starter plan includes unlimited AI messages with auto-reply + lead scoring.
                </p>
              </div>
            ) : (
              children
            )}
          </div>
          </div>{/* /left workspace column */}

          {/* AI builder — docked SIDE PANEL on the right edge, full height,
              side-by-side (md+). Not a modal: the workspace shrinks beside it. */}
          {panelOpen && (
            <aside className="w-full md:w-[380px] xl:w-[420px] md:shrink-0">
              <div className="h-[75vh] md:sticky md:top-4 md:h-[calc(100vh-6rem)]">
                <BuilderChatPanel
                  agentId={Number(current.id)}
                  className="h-full"
                />
              </div>
            </aside>
          )}
          </div>{/* /workspace + panel row */}
        </div>

        {/* Floating reopen button when the panel is closed */}
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Build with AI
          </button>
        )}
    </ModuleGuard>
  );
}
