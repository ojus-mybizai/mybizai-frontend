'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Sparkles, Boxes, Loader2, Workflow, Database, Bot, BarChart3,
  Users, Megaphone, MessageSquare, ListChecks, Settings, type LucideIcon,
} from 'lucide-react';
import ModuleGuard from '@/components/module-guard';
import NewSystemModal from '@/components/system-builder/NewSystemModal';
import { listSystems, type SystemSummary } from '@/services/system-builder';

const KIND_LABEL: Record<string, string> = {
  complaint: 'Complaint',
  sales: 'Sales',
  remarketing: 'Remarketing',
  marketing: 'Marketing',
  custom: 'Custom',
};

/* Lucide icon name → component, for a System's custom icon. */
const ICONS: Record<string, LucideIcon> = {
  Boxes, Workflow, Database, Bot, BarChart3, Users, Megaphone,
  MessageSquare, ListChecks, Settings,
};

const STATUS_TONE: Record<string, string> = {
  active: 'bg-success-soft text-success',
  draft: 'bg-warning-soft text-warning',
  archived: 'bg-card-bg text-text-secondary',
};

export default function SystemsPage() {
  return (
    <Suspense fallback={null}>
      <SystemsPageInner />
    </Suspense>
  );
}

function SystemsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [systems, setSystems] = useState<SystemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(() => {
    listSystems()
      .then((r) => setSystems(r.systems))
      .catch((e) => setError((e as Error).message || 'Could not load systems.'));
  }, []);

  useEffect(load, [load]);

  /* Deep-link: /systems?new=1 opens the create modal (from the sidebar row). */
  useEffect(() => {
    if (searchParams.get('new')) setNewOpen(true);
  }, [searchParams]);

  return (
    <ModuleGuard module="lms">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
              <Boxes className="h-5 w-5 text-accent" /> Systems
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Named setups that group your datasheets, pipelines, agents and shortcuts — built by AI or composed by hand.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3.5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent"
            >
              <Plus className="h-4 w-4" /> New system
            </button>
            <Link
              href="/systems/builder"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" /> Build with AI
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {systems === null && !error && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {systems?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-color px-6 py-16 text-center">
            <Sparkles className="h-8 w-8 text-accent/60" />
            <p className="max-w-sm text-sm text-text-secondary">
              No systems yet. Describe your business and the AI will propose a complete setup that you
              can build in one click.
            </p>
            <Link
              href="/systems/builder"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Build your first System
            </Link>
          </div>
        )}

        {systems && systems.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((s) => {
              const Icon = (s.icon && ICONS[s.icon]) || Boxes;
              return (
              <Link
                key={s.id}
                href={`/systems/${s.id}`}
                className="group rounded-2xl border border-border-color bg-card-bg p-4 transition hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary group-hover:text-accent">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: (s.color || '#6366f1') + '22', color: s.color || '#6366f1' }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s.status] ?? STATUS_TONE.draft}`}>
                    {s.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[12px] text-text-secondary">
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </span>
                  {s.created_at && <span>{new Date(s.created_at).toLocaleDateString()}</span>}
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>

      {newOpen && (
        <NewSystemModal
          onClose={() => setNewOpen(false)}
          onCreated={(s) => router.push(`/systems/${s.id}`)}
        />
      )}
    </ModuleGuard>
  );
}
