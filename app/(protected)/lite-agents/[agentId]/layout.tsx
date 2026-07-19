'use client';

import { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Zap, ArrowLeft } from 'lucide-react';
import { useLiteAgentStore } from '@/lib/lite-agent-store';
import { useShallow } from 'zustand/react/shallow';

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'channels', label: 'Channels' },
  { slug: 'test', label: 'Test' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

export default function LiteAgentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const agentId = params.agentId as string;

  const { current, select, setStatus } = useLiteAgentStore(
    useShallow((s) => ({ current: s.current, select: s.select, setStatus: s.setStatus })),
  );

  useEffect(() => {
    if (agentId) select(agentId);
  }, [agentId, select]);

  const activeTab = tabs.find((t) => pathname.includes(`/${t.slug}`))?.slug || 'overview';

  const handleToggle = async () => {
    if (!current) return;
    await setStatus(current.id, current.status === 'active' ? 'paused' : 'active');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Breadcrumb */}
      <Link
        href="/lite-agents"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Lite Agents
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
              {current?.name || 'Loading...'}
              {current && <StatusBadge status={current.status} />}
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                LITE
              </span>
            </h1>
          </div>
        </div>
        {current && (
          <button
            onClick={handleToggle}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              current.status === 'active'
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}
          >
            {current.status === 'active' ? 'Pause' : 'Deploy'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border-color">
        {tabs.map((tab) => (
          <Link
            key={tab.slug}
            href={`/lite-agents/${agentId}/${tab.slug}`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.slug
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
