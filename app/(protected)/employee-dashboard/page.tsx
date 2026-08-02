'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate as fmtDate } from '@/lib/format-date';
import { DateField } from '@/components/ui/date-field';
import {
  listWork,
  listWorkTemplates,
  logMyWork,
  getMyActivity,
  startWork,
  updateWork,
  type Work,
  type WorkTemplate,
  type WorkActivityItem,
  type LogMyWorkPayload,
} from '@/services/work';

// ─── Helpers ────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return fmtDate(new Date());
}

function formatDate(d: string | null | undefined, short = false): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(x);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (!short) {
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 7) return `In ${diff}d`;
    if (diff < 0) return `${Math.abs(diff)}d ago`;
  }
  return fmtDate(x);
}

function formatRelative(d: string | null | undefined): string {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const diff = Math.round((Date.now() - x.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(x);
}

function statusLabel(s: string): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'in_progress': return 'bg-accent/10 text-accent';
    case 'cancelled': return 'bg-bg-secondary text-text-secondary';
    default: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  }
}

function priorityDot(p: string): string {
  if (p === 'high') return 'bg-red-500';
  if (p === 'low') return 'bg-blue-400';
  return 'bg-amber-400';
}

function eventIcon(type: string): string {
  switch (type) {
    case 'work_started': return '▶';
    case 'work_completed': return '✓';
    case 'step_completed': return '☑';
    case 'step_reverted': return '↩';
    case 'form_submitted':
    case 'step_form_submitted': return '📝';
    case 'self_logged': return '✚';
    case 'status_changed': return '↕';
    default: return '●';
  }
}

function eventLabel(ev: WorkActivityItem): string {
  const name = ev.work_title || ev.work_type_name || `Work #${ev.work_id}`;
  const step = (ev.payload as Record<string, unknown>)?.step_order;
  switch (ev.event_type) {
    case 'work_started': return `Started "${name}"`;
    case 'work_completed': return `Completed "${name}"`;
    case 'step_completed': return `Done step ${step ?? ''} of "${name}"`;
    case 'step_reverted': return `Reverted step ${step ?? ''} of "${name}"`;
    case 'form_submitted': return `Submitted form for "${name}"`;
    case 'step_form_submitted': return `Filled step form for "${name}"`;
    case 'self_logged': return `Logged new work "${name}"`;
    case 'status_changed': return `Updated status of "${name}"`;
    default: return `Updated "${name}"`;
  }
}

function eventIconColor(type: string): string {
  switch (type) {
    case 'work_completed': return 'bg-green-500 text-white';
    case 'work_started': return 'bg-accent text-white';
    case 'self_logged': return 'bg-purple-500 text-white';
    case 'step_completed': return 'bg-emerald-500 text-white';
    case 'step_reverted': return 'bg-amber-500 text-white';
    default: return 'bg-bg-secondary text-text-secondary';
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color?: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-xl">
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${color ?? 'text-text-primary'}`}>{value}</div>
        <div className="text-xs text-text-secondary mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function WorkCard({
  w,
  today,
  updatingId,
  onStart,
  onComplete,
}: {
  w: Work;
  today: Date;
  updatingId: number | null;
  onStart: (id: number) => Promise<void>;
  onComplete: (id: number) => void;
}) {
  const router = useRouter();
  const isOverdue =
    w.due_date != null &&
    new Date(w.due_date) < today &&
    w.status !== 'completed' &&
    w.status !== 'cancelled';

  return (
    <div
      onClick={() => router.push(`/workstation?work=${w.id}`)}
      className={`group flex cursor-pointer flex-col rounded-xl border bg-card-bg p-4 transition-all hover:shadow-md hover:border-accent ${
        isOverdue ? 'border-l-4 border-l-red-500 border-border-color' : 'border-border-color'
      }`}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot(w.priority)}`} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-text-primary group-hover:text-accent truncate">
            {w.title || w.work_type_name || `Work #${w.id}`}
          </h3>
          <p className="text-xs text-text-secondary truncate">{w.work_type_name}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(w.status)}`}>
          {statusLabel(w.status)}
        </span>
        {w.template_type && w.template_type !== 'simple' && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary capitalize">
            {w.template_type}
          </span>
        )}
        {isOverdue && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
            ⚠ Overdue
          </span>
        )}
      </div>

      {/* Due date */}
      <div className="mt-2 text-xs text-text-secondary">
        Due: <span className={isOverdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
          {formatDate(w.due_date)}
        </span>
      </div>

      {/* Quick actions */}
      {(w.status === 'pending' || w.status === 'in_progress') && (
        <div
          className="mt-3 flex gap-2 border-t border-border-color pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {w.status === 'pending' && (
            <button
              type="button"
              disabled={updatingId === w.id}
              onClick={async () => {
                await onStart(w.id);
                router.push(`/workstation?work=${w.id}`);
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {updatingId === w.id ? 'Starting…' : '▶ Start'}
            </button>
          )}
          {w.status === 'in_progress' && (
            <button
              type="button"
              disabled={updatingId === w.id}
              onClick={() => onComplete(w.id)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {updatingId === w.id ? 'Saving…' : '✓ Complete'}
            </button>
          )}
          {/* View detail — always available as fallback for in_progress cards */}
          {w.status === 'in_progress' && (
            <Link
              href={`/workstation?work=${w.id}`}
              className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary"
            >
              Open
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Log Work Modal ──────────────────────────────────────────────────────────

function LogWorkModal({
  templates,
  onClose,
  onCreated,
}: {
  templates: WorkTemplate[];
  onClose: () => void;
  onCreated: (w: Work) => void;
}) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WorkTemplate | null>(null);
  const [form, setForm] = useState<LogMyWorkPayload>({ priority: 'medium' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = templates.filter(
    (t) =>
      t.is_active &&
      t.template_type !== 'datasheet' && // datasheet needs more context, skip for self-log
      (search === '' || t.name.toLowerCase().includes(search.toLowerCase()) ||
       t.work_type_name.toLowerCase().includes(search.toLowerCase())),
  );

  const pick = (t: WorkTemplate) => {
    setSelected(t);
    setForm({
      title: t.default_title ?? '',
      notes: t.default_notes ?? '',
      priority: 'medium',
      due_date: t.default_due_days
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + t.default_due_days!);
            return d.toISOString().slice(0, 10);
          })()
        : null,
    });
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setErr(null);
    try {
      const w = await logMyWork(selected.id, form);
      onCreated(w);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to create work.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-color bg-card-bg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <div>
            <h2 className="font-semibold text-text-primary">
              {step === 'pick' ? 'Choose a template' : `Log: ${selected?.name}`}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {step === 'pick'
                ? 'Pick a work template to log what you did'
                : 'Fill in the details for this work entry'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary"
          >
            ✕
          </button>
        </div>

        {step === 'pick' ? (
          <div className="p-5 space-y-3">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
            />
            {/* Template grid */}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">No templates found.</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(t)}
                    className="w-full flex items-start gap-3 rounded-xl border border-border-color bg-bg-primary p-3 text-left transition hover:border-accent hover:bg-accent/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-bold">
                      {t.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-text-primary text-sm truncate">{t.name}</div>
                      <div className="text-xs text-text-secondary">
                        {t.work_type_name}
                        {t.template_type && t.template_type !== 'simple' && (
                          <span className="ml-1.5 capitalize text-accent">· {t.template_type}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-text-secondary text-xs self-center">›</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
            {err && (
              <div className="rounded-lg bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {err}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Title</label>
              <input
                type="text"
                value={form.title ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={selected?.default_title ?? 'Work title…'}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Due date</label>
                <DateField
                  value={form.due_date ?? ''}
                  onChange={(iso) => setForm((f) => ({ ...f, due_date: iso || null }))}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
                <select
                  value={form.priority ?? 'medium'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as 'low' | 'medium' | 'high' }))
                  }
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
              <textarea
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Add any notes or context…"
                className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="flex-1 rounded-lg border border-border-color py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Log Work'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

function ActivityFeed({ userId }: { userId: number | null }) {
  const [activities, setActivities] = useState<WorkActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (p: number) => {
      if (userId == null) return;
      setLoading(true);
      try {
        const res = await getMyActivity(p, 10);
        if (p === 1) {
          setActivities(res.items);
        } else {
          setActivities((prev) => [...prev, ...res.items]);
        }
        setTotal(res.total);
        setPage(p);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const hasMore = activities.length < total;

  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden flex flex-col">
      <div className="border-b border-border-color px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-text-primary text-sm">My Activity</h2>
          <p className="text-xs text-text-secondary">{total} action{total !== 1 ? 's' : ''} logged</p>
        </div>
        <span className="text-lg">📋</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0 max-h-[480px]">
        {loading && activities.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-3 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-bg-secondary shrink-0" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-3 w-3/4 rounded bg-bg-secondary" />
                <div className="h-2.5 w-1/3 rounded bg-bg-secondary" />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-2xl mb-2">🕐</p>
            <p className="text-sm text-text-secondary">No activity yet.</p>
            <p className="text-xs text-text-secondary mt-1">Your actions will appear here.</p>
          </div>
        ) : (
          <>
            {activities.map((ev, i) => (
              <Link
                key={ev.id}
                href={`/workstation?work=${ev.work_id}`}
                className="flex gap-3 py-3 hover:bg-bg-secondary -mx-4 px-4 rounded-lg transition group"
              >
                {/* Icon + vertical line */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${eventIconColor(ev.event_type)}`}
                  >
                    {eventIcon(ev.event_type)}
                  </div>
                  {i < activities.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-border-color min-h-[12px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <p className="text-sm text-text-primary group-hover:text-accent leading-snug">
                    {eventLabel(ev)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">{formatRelative(ev.created_at)}</p>
                </div>
              </Link>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => void load(page + 1)}
                disabled={loading}
                className="w-full py-2 text-xs text-accent hover:underline disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type StatusTab = 'all' | 'pending' | 'in_progress' | 'completed';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

const PER_PAGE = 18;

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user) as { id?: number; name?: string } | null;
  const currentUserId = user?.id ?? null;
  const userName = user?.name ?? 'there';

  const [items, setItems] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [workPage, setWorkPage] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Templates for Log Work modal
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);

  // Computed date helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Stats derived from first-page load (all statuses)
  const [allItems, setAllItems] = useState<Work[]>([]);

  const load = useCallback(
    async (page: number, tab: StatusTab) => {
      if (currentUserId == null) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listWork({
          page,
          per_page: PER_PAGE,
          assigned_to_id: currentUserId,
          status: tab === 'all' ? undefined : tab,
        });
        setItems(res.items);
        setTotal(res.total);
        setWorkPage(page);
      } catch {
        setError('Failed to load your work.');
      } finally {
        setLoading(false);
      }
    },
    [currentUserId],
  );

  // Load all items once for stats
  const loadAll = useCallback(async () => {
    if (currentUserId == null) return;
    try {
      const res = await listWork({ page: 1, per_page: 100, assigned_to_id: currentUserId });
      setAllItems(res.items);
    } catch {
      /* ignore */
    }
  }, [currentUserId]);

  const loadTemplates = useCallback(async () => {
    try {
      const ts = await listWorkTemplates();
      setTemplates(ts);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load(1, 'all');
    void loadAll();
    void loadTemplates();
  }, [load, loadAll, loadTemplates]);

  const changeTab = (tab: StatusTab) => {
    setStatusTab(tab);
    void load(1, tab);
  };

  const quickStart = async (workId: number) => {
    setUpdatingId(workId);
    try {
      const updated = await startWork(workId);
      setItems((prev) => prev.map((w) => (w.id === workId ? updated : w)));
      setAllItems((prev) => prev.map((w) => (w.id === workId ? updated : w)));
    } catch {
      setError('Failed to start work.');
    } finally {
      setUpdatingId(null);
    }
  };

  const quickComplete = async (workId: number) => {
    setUpdatingId(workId);
    try {
      const updated = await updateWork(workId, { status: 'completed' });
      setItems((prev) => prev.map((w) => (w.id === workId ? updated : w)));
      setAllItems((prev) => prev.map((w) => (w.id === workId ? updated : w)));
    } catch {
      setError('Failed to complete work.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Stats from allItems
  const statsNow = new Date();
  const weekAgo = new Date(statsNow.getTime() - 7 * 86400000);
  const pendingCount = allItems.filter((w) => w.status === 'pending').length;
  const inProgressCount = allItems.filter((w) => w.status === 'in_progress').length;
  const doneThisWeek = allItems.filter(
    (w) =>
      w.status === 'completed' && w.completed_at && new Date(w.completed_at) >= weekAgo,
  ).length;
  const overdueCount = allItems.filter(
    (w) =>
      w.due_date &&
      new Date(w.due_date) < today &&
      w.status !== 'completed' &&
      w.status !== 'cancelled',
  ).length;

  // Upcoming deadlines (top 5 non-completed, soonest first)
  const upcoming = allItems
    .filter((w) => w.due_date && w.status !== 'completed' && w.status !== 'cancelled')
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <ModuleGuard module="lms">
      {showLogModal && (
        <LogWorkModal
          templates={templates}
          onClose={() => setShowLogModal(false)}
          onCreated={(w) => {
            setShowLogModal(false);
            // Navigate directly to the newly created work item
            router.push(`/workstation?work=${w.id}`);
          }}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {greeting()}, {userName.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{todayLabel()}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/work"
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
            >
              All Work
            </Link>
            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              + Log Work
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="📋" label="Pending" value={pendingCount} />
          <StatCard icon="⚡" label="In Progress" value={inProgressCount} color="text-accent" />
          <StatCard
            icon="✓"
            label="Done this week"
            value={doneThisWeek}
            color="text-green-600 dark:text-green-400"
          />
          <StatCard
            icon="⚠"
            label="Overdue"
            value={overdueCount}
            color={overdueCount > 0 ? 'text-red-600 dark:text-red-400' : undefined}
          />
        </div>

        {/* ── Main two-column layout ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Work list */}
          <div className="space-y-4">
            {/* Status tabs + count */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 rounded-lg bg-bg-secondary p-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => changeTab(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      statusTab === tab.key
                        ? 'bg-card-bg shadow-sm text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {!loading && (
                <span className="text-xs text-text-secondary">
                  {total} item{total !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Work cards */}
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 rounded-xl border border-border-color bg-card-bg animate-pulse"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-border-color bg-card-bg p-12 text-center">
                <p className="text-3xl mb-3">
                  {statusTab === 'completed' ? '🎉' : '📭'}
                </p>
                <p className="font-medium text-text-primary">
                  {statusTab === 'all'
                    ? 'No work assigned to you'
                    : statusTab === 'completed'
                    ? 'No completed work yet'
                    : `No ${statusTab.replace('_', ' ')} work`}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {statusTab === 'all'
                    ? 'Use "Log Work" to record work you did on your own'
                    : 'Work items will appear here as they change status'}
                </p>
                {statusTab === 'all' && (
                  <button
                    type="button"
                    onClick={() => setShowLogModal(true)}
                    className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
                  >
                    + Log Work
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((w) => (
                    <WorkCard
                      key={w.id}
                      w={w}
                      today={today}
                      updatingId={updatingId}
                      onStart={quickStart}
                      onComplete={quickComplete}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={workPage === 1}
                      onClick={() => void load(workPage - 1, statusTab)}
                      className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-text-secondary">
                      Page {workPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={workPage === totalPages}
                      onClick={() => void load(workPage + 1, statusTab)}
                      className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            {/* Activity feed */}
            <ActivityFeed userId={currentUserId} />

            {/* Upcoming deadlines */}
            {upcoming.length > 0 && (
              <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
                <div className="border-b border-border-color px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary text-sm">Upcoming Deadlines</h2>
                  <span className="text-lg">🗓</span>
                </div>
                <ul className="divide-y divide-border-color">
                  {upcoming.map((w) => {
                    const isOverdue =
                      w.due_date != null &&
                      new Date(w.due_date) < today &&
                      w.status !== 'completed' &&
                      w.status !== 'cancelled';
                    return (
                      <li key={w.id}>
                        <Link
                          href={`/workstation?work=${w.id}`}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-secondary text-sm transition"
                        >
                          <span className="truncate text-text-primary max-w-[160px]">
                            {w.title || w.work_type_name || `Work #${w.id}`}
                          </span>
                          <span
                            className={`shrink-0 ml-2 text-xs font-medium ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-text-secondary'
                            }`}
                          >
                            {isOverdue ? '⚠ ' : ''}{formatDate(w.due_date)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Quick links */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-2">
              <h2 className="font-semibold text-text-primary text-sm mb-3">Quick Links</h2>
              {[
                { href: '/work?filter=overdue', icon: '⚠', label: 'Overdue work' },
                { href: '/work', icon: '📋', label: 'All assigned work' },
                { href: '/inbox', icon: '💬', label: 'Inbox' },
                { href: '/contacts', icon: '👥', label: 'Contacts' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition"
                >
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                  <span className="ml-auto text-text-secondary">›</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}
