'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { EditEmployeeModal } from '@/components/employees/edit-employee-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  getEmployeeDetail,
  getEmployeeActivity,
  type EmployeeDetail,
  type EmployeeLifecycleEvent,
  type EmployeeReportRow,
  type EmployeeRole,
} from '@/services/employees';
import { listCustomers, type Customer } from '@/services/customers';
import { listWork, type Work } from '@/services/work';
import { listEmployeeActivity, type ActivityLogItem } from '@/services/activity';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'work' | 'leads' | 'activity';
type WorkStatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'leads', label: 'Leads' },
  { id: 'activity', label: 'Activity' },
];

const WORK_STATUS_FILTERS: { id: WorkStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const ROLE_LABELS: Record<EmployeeRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  executive: 'Executive',
};

const ROLE_COLORS: Record<EmployeeRole, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  executive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const STATUS_WORK_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  contacted: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  qualified: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  proposal: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  negotiation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  lost: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
};

const TEMPLATE_TYPE_COLORS: Record<string, string> = {
  simple: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  checklist: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  datasheet: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const EVENT_LABELS: Record<string, string> = {
  invite_created: 'Invite sent',
  invite_accepted: 'Joined the team',
  invite_resend: 'Invite resent',
  invite_revoked: 'Invite revoked',
  employee_created_compat: 'Added to team',
  employee_updated: 'Profile updated',
  role_changed: 'Role changed',
  employee_reactivated: 'Account reactivated',
  employee_deactivated: 'Account deactivated',
  employee_removed: 'Removed from team',
};

const EVENT_ICONS: Record<string, string> = {
  invite_created: '✉️',
  invite_accepted: '🎉',
  invite_resend: '🔄',
  invite_revoked: '🚫',
  employee_created_compat: '👋',
  employee_updated: '✏️',
  role_changed: '🔁',
  employee_reactivated: '✅',
  employee_deactivated: '⏸️',
  employee_removed: '🗑️',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status: string): string {
  if (status === 'in_progress') return 'In Progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function toEmployeeReportRow(detail: EmployeeDetail): EmployeeReportRow {
  return {
    id: detail.id,
    user_id: detail.user_id,
    name: detail.name,
    email: detail.email,
    role: detail.role,
    is_active: detail.is_active,
    assigned_lead_count: detail.assigned_lead_count,
    assigned_work_count: detail.assigned_work_count,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'red' | 'green' | 'blue' | 'amber';
  onClick?: () => void;
}) {
  const numColor =
    accent === 'red'
      ? 'text-red-600 dark:text-red-400'
      : accent === 'green'
        ? 'text-emerald-600 dark:text-emerald-400'
        : accent === 'blue'
          ? 'text-blue-600 dark:text-blue-400'
          : accent === 'amber'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-text-primary';

  const base = 'rounded-xl border border-border-color bg-card-bg p-4 text-left';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} hover:border-accent transition-colors w-full`}>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${numColor}`}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
      </button>
    );
  }
  return (
    <div className={base}>
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${numColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

function StatusBar({
  breakdown,
}: {
  breakdown: { pending: number; in_progress: number; completed: number; cancelled: number };
}) {
  const total =
    breakdown.pending + breakdown.in_progress + breakdown.completed + breakdown.cancelled;
  if (total === 0)
    return <p className="text-sm text-text-secondary">No work assigned yet.</p>;

  const segments = [
    {
      key: 'completed' as const,
      pct: (breakdown.completed / total) * 100,
      bar: 'bg-emerald-500',
      dot: 'bg-emerald-500',
      label: 'Completed',
    },
    {
      key: 'in_progress' as const,
      pct: (breakdown.in_progress / total) * 100,
      bar: 'bg-blue-500',
      dot: 'bg-blue-500',
      label: 'In Progress',
    },
    {
      key: 'pending' as const,
      pct: (breakdown.pending / total) * 100,
      bar: 'bg-amber-400',
      dot: 'bg-amber-400',
      label: 'Pending',
    },
    {
      key: 'cancelled' as const,
      pct: (breakdown.cancelled / total) * 100,
      bar: 'bg-gray-300 dark:bg-gray-600',
      dot: 'bg-gray-400',
      label: 'Cancelled',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-secondary">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.key}
              className={`${s.bar} transition-all`}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${s.pct.toFixed(0)}%`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}: <strong className="text-text-primary">{breakdown[s.key]}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Expandable work row with inline form-data preview */
function WorkRow({
  w,
  expanded,
  onToggle,
}: {
  w: Work;
  expanded: boolean;
  onToggle: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isOverdue =
    w.due_date &&
    new Date(w.due_date) < today &&
    w.status !== 'completed' &&
    w.status !== 'cancelled';

  const hasFormData =
    w.form_data != null && Object.keys(w.form_data as object).length > 0;
  const isChecklist = w.template_type === 'checklist';
  const isDatasheet = w.template_type === 'datasheet';
  const hasExpandable = hasFormData || isChecklist || isDatasheet;

  return (
    <>
      <tr className="hover:bg-bg-secondary/40 transition-colors">
        {/* Work title + type */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2 min-w-0">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                w.priority === 'high'
                  ? 'bg-red-500'
                  : w.priority === 'medium'
                    ? 'bg-amber-400'
                    : 'bg-slate-400'
              }`}
            />
            <div className="min-w-0">
              <p className="truncate max-w-[200px] text-sm font-medium text-text-primary">
                {w.title || w.work_type_name || `Work #${w.id}`}
              </p>
              <p className="text-xs text-text-secondary truncate">{w.work_type_name}</p>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_WORK_COLORS[w.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {statusLabel(w.status)}
          </span>
        </td>

        {/* Template type */}
        <td className="px-4 py-3">
          {w.template_type ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                TEMPLATE_TYPE_COLORS[w.template_type] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {w.template_type.charAt(0).toUpperCase() + w.template_type.slice(1)}
            </span>
          ) : (
            <span className="text-xs text-text-secondary">—</span>
          )}
        </td>

        {/* Due date */}
        <td className="px-4 py-3">
          <span
            className={`text-xs ${
              isOverdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-text-secondary'
            }`}
          >
            {isOverdue && '⚠ '}
            {formatDate(w.due_date)}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {hasExpandable && (
              <button
                type="button"
                onClick={onToggle}
                title={expanded ? 'Hide preview' : 'Preview submission data'}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  expanded
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-accent hover:bg-accent/10'
                }`}
              >
                {expanded ? '▲ Hide' : '📋 Data'}
              </button>
            )}
            <Link
              href={`/workstation?work=${w.id}`}
              className="rounded border border-border-color px-2 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              View →
            </Link>
          </div>
        </td>
      </tr>

      {/* Expandable: inline form submission / template info */}
      {expanded && hasExpandable && (
        <tr>
          <td
            colSpan={5}
            className="border-t border-dashed border-border-color bg-bg-secondary/50 px-6 py-4"
          >
            {hasFormData ? (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  📋 Form Submission
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {Object.entries(w.form_data as Record<string, unknown>).map(([key, val]) => {
                    if (val == null || val === '') return null;
                    const strVal = String(val);
                    const isImage = strVal.startsWith('data:image');
                    const isLocation =
                      /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(strVal);
                    return (
                      <div key={key} className="flex gap-2 text-sm">
                        <span className="shrink-0 min-w-[110px] font-medium text-text-secondary capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={strVal}
                            alt={key}
                            className="max-h-28 rounded-lg border border-border-color object-contain"
                          />
                        ) : isLocation ? (
                          <a
                            href={`https://www.google.com/maps?q=${encodeURIComponent(strVal)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            📍 {strVal} ↗
                          </a>
                        ) : (
                          <span className="text-text-primary break-words">{strVal}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Link
                  href={`/workstation?work=${w.id}`}
                  className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
                >
                  View full work details →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">
                  {isChecklist
                    ? '📋 Checklist work — click View to see step-by-step completion and per-step form submissions.'
                    : isDatasheet
                      ? '📊 Datasheet work — click View to see record-level progress and field submissions.'
                      : 'No form data submitted yet.'}
                </p>
                <Link
                  href={`/workstation?work=${w.id}`}
                  className="shrink-0 rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
                >
                  View full details →
                </Link>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border-color px-5 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={onPrev}
        className="rounded-lg border border-border-color px-3 py-1.5 text-sm text-text-primary disabled:opacity-40 hover:border-accent"
      >
        ← Previous
      </button>
      <span className="text-sm text-text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={onNext}
        className="rounded-lg border border-border-color px-3 py-1.5 text-sm text-text-primary disabled:opacity-40 hover:border-accent"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = Number(params?.id);

  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isOwner = useAuthStore((s) => s.isOwner);
  const canManageEmployees = hasPermission('manage_employees');

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeReportRow | null>(null);

  // Work tab
  const [workStatusFilter, setWorkStatusFilter] = useState<WorkStatusFilter>('all');
  const [workItems, setWorkItems] = useState<Work[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workTotal, setWorkTotal] = useState(0);
  const [workTotalPages, setWorkTotalPages] = useState(1);
  const [workPage, setWorkPage] = useState(1);
  const [expandedWorkId, setExpandedWorkId] = useState<number | null>(null);

  // Leads tab
  const [leads, setLeads] = useState<Customer[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);

  // Activity tab
  const [activity, setActivity] = useState<EmployeeLifecycleEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  // Business Activity Feed
  const [bizActivity, setBizActivity] = useState<ActivityLogItem[]>([]);
  const [bizActivityPage, setBizActivityPage] = useState(1);
  const [bizActivityTotalPages, setBizActivityTotalPages] = useState(1);
  const [bizActivityTotal, setBizActivityTotal] = useState(0);
  const [bizActivityLoading, setBizActivityLoading] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(employeeId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeDetail(employeeId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee details.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadWork = useCallback(async () => {
    if (!detail) return;
    setWorkLoading(true);
    try {
      const data = await listWork({
        page: workPage,
        per_page: 15,
        assigned_to_id: detail.user_id,
        status: workStatusFilter !== 'all' ? workStatusFilter : null,
      });
      setWorkItems(data.items);
      setWorkTotal(data.total);
      setWorkTotalPages(data.total_pages);
    } catch {
      setWorkItems([]);
    } finally {
      setWorkLoading(false);
    }
  }, [detail, workPage, workStatusFilter]);

  const loadLeads = useCallback(async () => {
    if (!detail) return;
    setLeadsLoading(true);
    try {
      const data = await listCustomers({
        page: leadsPage,
        perPage: 15,
        assignedToId: detail.user_id,
      });
      setLeads(data.items);
      setLeadsTotal(data.total ?? data.items.length);
      setLeadsTotalPages(data.totalPages);
    } catch {
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, [detail, leadsPage]);

  const loadActivity = useCallback(async () => {
    if (!detail) return;
    setActivityLoading(true);
    try {
      const data = await getEmployeeActivity(detail.id, { page: activityPage, per_page: 20 });
      setActivity(data.items);
      setActivityTotalPages(data.total_pages);
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [detail, activityPage]);

  const loadBizActivity = useCallback(async () => {
    if (!detail) return;
    setBizActivityLoading(true);
    try {
      const data = await listEmployeeActivity(detail.user_id, { page: bizActivityPage, per_page: 20 });
      setBizActivity(data.items);
      setBizActivityTotal(data.total);
      setBizActivityTotalPages(data.total_pages);
    } catch {
      setBizActivity([]);
    } finally {
      setBizActivityLoading(false);
    }
  }, [detail, bizActivityPage]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { void loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (detail && activeTab === 'work') void loadWork();
  }, [detail, activeTab, loadWork]);

  useEffect(() => {
    if (detail && activeTab === 'leads') void loadLeads();
  }, [detail, activeTab, loadLeads]);

  useEffect(() => {
    if (detail && activeTab === 'activity') void loadActivity();
  }, [detail, activeTab, loadActivity]);

  useEffect(() => { if (detail && activeTab === 'activity') void loadBizActivity(); }, [detail, activeTab, loadBizActivity]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleWorkFilter = (f: WorkStatusFilter) => {
    setWorkStatusFilter(f);
    setWorkPage(1);
    setExpandedWorkId(null);
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setExpandedWorkId(null);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const breakdown = detail?.work_breakdown;
  const totalWork = useMemo(
    () =>
      breakdown
        ? breakdown.pending + breakdown.in_progress + breakdown.completed + breakdown.cancelled
        : 0,
    [breakdown],
  );
  const completionRate =
    totalWork > 0 && breakdown ? Math.round((breakdown.completed / totalWork) * 100) : 0;
  const openWork = breakdown ? breakdown.pending + breakdown.in_progress : 0;

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!Number.isFinite(employeeId)) {
    return (
      <ModuleGuard module="lms">
        <div className="rounded-xl border border-border-color bg-card-bg p-6">
          <p className="text-text-secondary">Invalid employee ID.</p>
          <Link
            href="/employees"
            className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
          >
            ← Back to Team
          </Link>
        </div>
      </ModuleGuard>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ModuleGuard module="lms">
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">

        {/* Back nav */}
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push('/employees')
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent"
        >
          ← Back
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-secondary" />
            ))}
          </div>
        )}

        {!loading && detail && (
          <>
            {/* ── Profile header ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border-color bg-card-bg p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Initials avatar */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl font-bold text-accent">
                    {getInitials(detail.name)}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-text-primary">{detail.name}</h1>
                    <p className="mt-0.5 text-sm text-text-secondary">{detail.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[detail.role]}`}
                      >
                        {ROLE_LABELS[detail.role]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          detail.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                        }`}
                      >
                        {detail.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {(isOwner || canManageEmployees) && (
                    <button
                      type="button"
                      onClick={() => setEditEmployee(toEmployeeReportRow(detail))}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
                    >
                      Manage
                    </button>
                  )}
                  <Link
                    href={`/work?assigned_to_id=${detail.user_id}`}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent/90"
                  >
                    All Work ↗
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Stat cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label="Leads"
                value={detail.assigned_lead_count}
                onClick={() => handleTabChange('leads')}
              />
              <StatCard label="Total Work" value={detail.assigned_work_count} />
              <StatCard
                label="Open"
                value={openWork}
                accent="blue"
                sub="pending + in-progress"
                onClick={() => { handleTabChange('work'); handleWorkFilter('pending'); }}
              />
              <StatCard
                label="Completed"
                value={breakdown?.completed ?? 0}
                accent="green"
                sub={`${completionRate}% rate`}
                onClick={() => { handleTabChange('work'); handleWorkFilter('completed'); }}
              />
              <StatCard
                label="Overdue"
                value={breakdown?.overdue ?? 0}
                accent={(breakdown?.overdue ?? 0) > 0 ? 'red' : undefined}
              />
              <StatCard label="Cancelled" value={breakdown?.cancelled ?? 0} />
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 rounded-xl border border-border-color bg-card-bg p-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─────────── OVERVIEW TAB ─────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Performance card */}
                <div className="rounded-xl border border-border-color bg-card-bg p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary">Work Performance</h2>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-accent">{completionRate}%</span>
                      <p className="text-xs text-text-secondary">completion rate</p>
                    </div>
                  </div>
                  <StatusBar breakdown={breakdown!} />

                  {/* Per-status breakdown rows */}
                  <div className="mt-5 space-y-2">
                    {[
                      {
                        label: 'In Progress',
                        value: breakdown?.in_progress ?? 0,
                        cls: 'text-blue-600 dark:text-blue-400',
                        filter: 'in_progress' as WorkStatusFilter,
                      },
                      {
                        label: 'Pending',
                        value: breakdown?.pending ?? 0,
                        cls: 'text-amber-600 dark:text-amber-400',
                        filter: 'pending' as WorkStatusFilter,
                      },
                      {
                        label: 'Completed',
                        value: breakdown?.completed ?? 0,
                        cls: 'text-emerald-600 dark:text-emerald-400',
                        filter: 'completed' as WorkStatusFilter,
                      },
                      {
                        label: 'Cancelled',
                        value: breakdown?.cancelled ?? 0,
                        cls: 'text-gray-500',
                        filter: 'cancelled' as WorkStatusFilter,
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="w-24 text-xs font-medium text-text-secondary">
                          {row.label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.label === 'Completed'
                                ? 'bg-emerald-500'
                                : row.label === 'In Progress'
                                  ? 'bg-blue-500'
                                  : row.label === 'Pending'
                                    ? 'bg-amber-400'
                                    : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            style={{ width: totalWork > 0 ? `${(row.value / totalWork) * 100}%` : '0%' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleTabChange('work');
                            handleWorkFilter(row.filter);
                          }}
                          className={`w-8 text-right text-sm font-bold ${row.cls} hover:underline`}
                        >
                          {row.value}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick action links */}
                <div className="rounded-xl border border-border-color bg-card-bg p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-text-primary">Quick Actions</h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTabChange('work')}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent hover:text-accent"
                    >
                      📋 Assigned work ({detail.assigned_work_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('leads')}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent hover:text-accent"
                    >
                      👥 Assigned leads ({detail.assigned_lead_count})
                    </button>
                    <Link
                      href={`/work?assigned_to_id=${detail.user_id}&status=completed`}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent hover:text-accent"
                    >
                      ✅ Completed work ({breakdown?.completed ?? 0}) ↗
                    </Link>
                    {(breakdown?.overdue ?? 0) > 0 && (
                      <Link
                        href={`/work?assigned_to_id=${detail.user_id}&overdue=true`}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:border-red-400 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400"
                      >
                        ⚠ Overdue work ({breakdown?.overdue ?? 0}) ↗
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─────────── WORK TAB ─────────────────────────────────────── */}
            {activeTab === 'work' && (
              <div className="rounded-xl border border-border-color bg-card-bg shadow-sm">
                {/* Header + filter pills */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color px-5 py-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {workLoading
                      ? 'Loading…'
                      : `${workTotal} work item${workTotal !== 1 ? 's' : ''}${
                          workStatusFilter !== 'all'
                            ? ` · ${statusLabel(workStatusFilter)}`
                            : ''
                        }`}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {WORK_STATUS_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleWorkFilter(f.id)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          workStatusFilter === f.id
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                {workLoading ? (
                  <div className="animate-pulse p-8 text-center text-sm text-text-secondary">
                    Loading work items…
                  </div>
                ) : workItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-text-secondary">
                      No{' '}
                      {workStatusFilter !== 'all'
                        ? statusLabel(workStatusFilter).toLowerCase()
                        : ''}{' '}
                      work found.
                    </p>
                    {workStatusFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => handleWorkFilter('all')}
                        className="mt-2 text-xs text-accent hover:underline"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-bg-secondary">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Work
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Status
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Template
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Due
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color">
                        {workItems.map((w) => (
                          <WorkRow
                            key={w.id}
                            w={w}
                            expanded={expandedWorkId === w.id}
                            onToggle={() =>
                              setExpandedWorkId((prev) => (prev === w.id ? null : w.id))
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  page={workPage}
                  totalPages={workTotalPages}
                  onPrev={() => setWorkPage((p) => p - 1)}
                  onNext={() => setWorkPage((p) => p + 1)}
                />

                {/* Hint row */}
                <div className="border-t border-dashed border-border-color px-5 py-2.5">
                  <p className="text-xs text-text-secondary">
                    💡 <strong>📋 Data</strong> previews form submissions inline.{' '}
                    <strong>View →</strong> opens full detail with checklist steps, datasheet
                    records, and all submitted data.
                  </p>
                </div>
              </div>
            )}

            {/* ─────────── LEADS TAB ────────────────────────────────────── */}
            {activeTab === 'leads' && (
              <div className="rounded-xl border border-border-color bg-card-bg shadow-sm">
                <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {leadsLoading ? 'Loading…' : `${leadsTotal} lead${leadsTotal !== 1 ? 's' : ''} assigned`}
                  </p>
                  <Link
                    href={`/customers?assigned_to_id=${detail.user_id}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Open in CRM ↗
                  </Link>
                </div>

                {leadsLoading ? (
                  <div className="animate-pulse p-8 text-center text-sm text-text-secondary">
                    Loading leads…
                  </div>
                ) : leads.length === 0 ? (
                  <div className="p-8 text-center text-sm text-text-secondary">
                    No leads assigned to this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-bg-secondary">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Name
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Phone
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Status
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Source
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color">
                        {leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-text-primary">
                              {lead.name || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {lead.phone || '—'}
                            </td>
                            <td className="px-4 py-3">
                              {lead.status ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                    LEAD_STATUS_COLORS[lead.status] ??
                                    'bg-bg-secondary text-text-secondary'
                                  }`}
                                >
                                  {lead.status}
                                </span>
                              ) : (
                                <span className="text-xs text-text-secondary">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm capitalize text-text-secondary">
                              {lead.source || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="text-xs font-semibold text-accent hover:underline"
                              >
                                Open →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  page={leadsPage}
                  totalPages={leadsTotalPages}
                  onPrev={() => setLeadsPage((p) => p - 1)}
                  onNext={() => setLeadsPage((p) => p + 1)}
                />
              </div>
            )}

            {/* ─────────── ACTIVITY TAB ─────────────────────────────────── */}
            {activeTab === 'activity' && (
              <div className="space-y-4">
                {/* Business Activity Feed — unified actions log */}
                <div className="rounded-xl border border-border-color bg-card-bg shadow-sm">
                  <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
                    <p className="text-sm font-semibold text-text-primary">
                      Activity Feed{bizActivityTotal > 0 ? ` (${bizActivityTotal})` : ''}
                    </p>
                    <p className="text-xs text-text-secondary">Notes · Work · Updates</p>
                  </div>
                  {bizActivityLoading ? (
                    <div className="animate-pulse p-6 text-center text-sm text-text-secondary">Loading…</div>
                  ) : bizActivity.length === 0 ? (
                    <div className="p-6 text-center text-sm text-text-secondary">No activity recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-border-color">
                      {bizActivity.map((item) => {
                        const ACTION_ICONS: Record<string, string> = {
                          lead_created: '➕', lead_note_added: '📝', lead_note_deleted: '🗑️',
                          lead_status_changed: '🔄', lead_updated: '✏️', lead_assigned: '👤', lead_deleted: '❌',
                          datasheet_model_created: '📊', datasheet_model_updated: '📊', datasheet_model_deleted: '🗑️',
                          datasheet_record_created: '➕', datasheet_record_updated: '📊', datasheet_record_deleted: '🗑️',
                          datasheet_records_imported: '📥',
                          work_created: '📋', work_started: '▶️', work_completed: '✅', work_deleted: '❌',
                          work_form_submitted: '📋', work_step_completed: '☑️', work_record_done: '✔️',
                          work_record_created: '➕',
                          employee_invited: '✉️', employee_created: '👤', employee_updated: '✏️',
                          employee_deactivated: '🚫', employee_removed: '❌',
                          call_made: '📞',
                          order_created: '🛒', order_updated: '✏️', order_deleted: '🗑️',
                          catalog_item_created: '📦', catalog_item_updated: '✏️', catalog_item_deleted: '🗑️',
                          contact_created: '👥', contact_updated: '✏️', contact_deleted: '🗑️',
                          appointment_created: '📅', appointment_updated: '✏️', appointment_deleted: '🗑️',
                          channel_created: '📡', channel_deleted: '🗑️',
                          conversation_mode_changed: '💬',
                          business_updated: '🏢', storefront_updated: '🏪',
                          role_created: '🔑', role_updated: '🔑', role_deleted: '🗑️', profile_updated: '👤',
                        };
                        const ACTION_LABELS: Record<string, string> = {
                          lead_created: 'Created lead', lead_note_added: 'Added note to lead',
                          lead_note_deleted: 'Deleted lead note',
                          lead_status_changed: 'Changed lead status', lead_updated: 'Updated lead',
                          lead_assigned: 'Assigned lead', lead_deleted: 'Deleted lead',
                          datasheet_model_created: 'Created datasheet', datasheet_model_updated: 'Updated datasheet',
                          datasheet_model_deleted: 'Deleted datasheet',
                          datasheet_record_created: 'Created record', datasheet_record_updated: 'Updated record',
                          datasheet_record_deleted: 'Deleted record', datasheet_records_imported: 'Imported records',
                          work_created: 'Created work', work_started: 'Started work',
                          work_completed: 'Completed work', work_deleted: 'Deleted work',
                          work_form_submitted: 'Submitted work form', work_step_completed: 'Completed step',
                          work_record_done: 'Marked record done', work_record_created: 'Created record via work',
                          employee_invited: 'Invited employee', employee_created: 'Added employee',
                          employee_updated: 'Updated employee', employee_deactivated: 'Deactivated employee',
                          employee_removed: 'Removed employee',
                          call_made: 'Made a call',
                          order_created: 'Created order', order_updated: 'Updated order', order_deleted: 'Deleted order',
                          catalog_item_created: 'Added catalog item', catalog_item_updated: 'Updated catalog item',
                          catalog_item_deleted: 'Deleted catalog item',
                          contact_created: 'Created contact', contact_updated: 'Updated contact',
                          contact_deleted: 'Deleted contact',
                          appointment_created: 'Created appointment', appointment_updated: 'Updated appointment',
                          appointment_deleted: 'Deleted appointment',
                          channel_created: 'Configured channel', channel_deleted: 'Removed channel',
                          conversation_mode_changed: 'Changed conversation mode',
                          business_updated: 'Updated business settings', storefront_updated: 'Updated storefront',
                          role_created: 'Created role', role_updated: 'Updated role', role_deleted: 'Deleted role',
                          profile_updated: 'Updated profile',
                        };
                        return (
                          <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-bg-secondary/30">
                            <span className="mt-0.5 text-base shrink-0">{ACTION_ICONS[item.action_type] ?? '•'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-sm font-medium text-text-primary">
                                  {ACTION_LABELS[item.action_type] ?? item.action_type.replace(/_/g, ' ')}
                                  {item.entity_name && (
                                    <span className="ml-1 font-normal text-text-secondary">
                                      — {item.entity_name}
                                    </span>
                                  )}
                                </p>
                                <p className="shrink-0 text-xs text-text-secondary">
                                  {item.created_at
                                    ? new Date(item.created_at).toLocaleString(undefined, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      })
                                    : ''}
                                </p>
                              </div>
                              {item.metadata && Object.keys(item.metadata).length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-secondary">
                                  {item.action_type === 'lead_note_added' && Boolean(item.metadata.preview) && (
                                    <span className="italic">"{String(item.metadata.preview)}"</span>
                                  )}
                                  {Boolean(item.metadata.old_status) && Boolean(item.metadata.new_status) && (
                                    <span>{String(item.metadata.old_status)} → {String(item.metadata.new_status)}</span>
                                  )}
                                </div>
                              )}
                              {item.work_id && (
                                <Link
                                  href={`/workstation?work=${item.work_id}`}
                                  className="mt-0.5 text-xs text-accent hover:underline"
                                >
                                  View work →
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Pagination */}
                  {bizActivityTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border-color px-5 py-3">
                      <button type="button" disabled={bizActivityPage <= 1} onClick={() => setBizActivityPage((p) => p - 1)} className="rounded-lg border border-border-color px-3 py-1.5 text-sm disabled:opacity-40">← Prev</button>
                      <span className="text-sm text-text-secondary">Page {bizActivityPage} of {bizActivityTotalPages}</span>
                      <button type="button" disabled={bizActivityPage >= bizActivityTotalPages} onClick={() => setBizActivityPage((p) => p + 1)} className="rounded-lg border border-border-color px-3 py-1.5 text-sm disabled:opacity-40">Next →</button>
                    </div>
                  )}
                </div>

                {/* Lifecycle Events (existing) */}
              <div className="rounded-xl border border-border-color bg-card-bg shadow-sm">
                <div className="border-b border-border-color px-5 py-3">
                  <p className="text-sm font-semibold text-text-primary">Activity timeline</p>
                </div>

                {activityLoading ? (
                  <div className="animate-pulse p-8 text-center text-sm text-text-secondary">
                    Loading activity…
                  </div>
                ) : activity.length === 0 ? (
                  <div className="p-8 text-center text-sm text-text-secondary">
                    No activity recorded yet.
                  </div>
                ) : (
                  <div className="relative px-5 py-4">
                    {/* Vertical timeline line */}
                    <div
                      className="absolute bottom-4 left-[2.25rem] top-4 w-px bg-border-color"
                      aria-hidden
                    />
                    <div className="space-y-5">
                      {activity.map((evt) => {
                        const meta = evt.metadata_json;
                        const hasUsefulMeta =
                          meta != null &&
                          Object.values(meta).some((v) => v != null && v !== '');
                        return (
                          <div key={evt.id} className="relative flex gap-4">
                            {/* Icon bubble */}
                            <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-color bg-card-bg text-sm">
                              {EVENT_ICONS[evt.event_type] ?? '📌'}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-sm font-semibold text-text-primary">
                                  {EVENT_LABELS[evt.event_type] ?? evt.event_type}
                                </p>
                                <p className="shrink-0 text-xs text-text-secondary">
                                  {formatDateTime(evt.created_at)}
                                </p>
                              </div>
                              {evt.actor_name && (
                                <p className="mt-0.5 text-xs text-text-secondary">
                                  by {evt.actor_name}
                                </p>
                              )}
                              {hasUsefulMeta && (
                                <div className="mt-2 rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-secondary space-y-0.5">
                                  {evt.event_type === 'role_changed' ? (
                                    <p>
                                      Role:{' '}
                                      <span className="font-medium text-text-primary">
                                        {meta!.old_role
                                          ? `${String(meta!.old_role)} → ${String(meta!.new_role)}`
                                          : String(meta!.new_role)}
                                      </span>
                                    </p>
                                  ) : (
                                    Object.entries(meta!).map(([k, v]) =>
                                      v != null && v !== '' ? (
                                        <p key={k}>
                                          <span className="font-medium capitalize">
                                            {k.replace(/_/g, ' ')}:
                                          </span>{' '}
                                          {String(v)}
                                        </p>
                                      ) : null,
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Pagination
                  page={activityPage}
                  totalPages={activityTotalPages}
                  onPrev={() => setActivityPage((p) => p - 1)}
                  onNext={() => setActivityPage((p) => p + 1)}
                />
              </div>
              </div>
            )}
          </>
        )}
      </div>

      <EditEmployeeModal
        isOpen={!!editEmployee}
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onSaved={() => {
          setEditEmployee(null);
          void loadDetail();
        }}
      />
    </ModuleGuard>
  );
}
