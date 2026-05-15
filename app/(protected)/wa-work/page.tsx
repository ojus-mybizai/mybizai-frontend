'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Send, CheckCircle, AlertCircle,
  RefreshCw, X, Calendar, MessageSquare, Users,
  AlertTriangle, ChevronRight, Search,
} from 'lucide-react';
import {
  listWorkItems, deleteWorkItem, dispatchWorkItem,
  updateAssignmentStatus, getWorkStats, getWorkItem, resendAssignment,
  type WaWorkItem, type WaWorkStats, type WaWorkAssignment,
  type AssignmentStatus, type WaWorkStatus,
} from '@/services/waWork';
import { listTemplates, type WaTemplate } from '@/services/waTemplates';
import {
  listEmployees, listGroups, getWaSettings,
  type WaEmployee, type WaEmployeeGroup, type WaSettings,
} from '@/services/waEmployees';
import { contactTypesService, type ContactTypeDef } from '@/services/contacts';
import { ByEmployeePanel } from '@/components/wa-work/by-employee-panel';
import { ByTemplatePanel } from '@/components/wa-work/by-template-panel';
import { TaskComposer } from '@/components/wa-work/task-composer';

/* ─── constants ──────────────────────────────────────────── */

type ViewMode = 'items' | 'by_employee' | 'by_template';

const VIEW_TABS: { value: ViewMode; label: string }[] = [
  { value: 'items',       label: 'Work Items'  },
  { value: 'by_employee', label: 'By Employee' },
  { value: 'by_template', label: 'By Template' },
];

const STATUS_TABS: { value: WaWorkStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'dispatched', label: 'Live' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WORK_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-bg-secondary text-text-secondary',
  dispatched: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

/* ─── helpers ────────────────────────────────────────────── */

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── skeleton ───────────────────────────────────────────── */

function SkeletonList() {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl bg-bg-secondary p-3 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-border-color" />
          <div className="h-2.5 w-1/2 rounded bg-border-color" />
        </div>
      ))}
    </div>
  );
}

/* ─── assignment card ────────────────────────────────────── */

interface AssignmentCardProps {
  a: WaWorkAssignment;
  onStatus: (id: number, status: AssignmentStatus) => void;
  onResend: (id: number) => void;
}

function AssignmentCard({ a, onStatus, onResend }: AssignmentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const effectiveStatus =
    a.status === 'pending' && a.wa_message_id && !a.responded_at ? 'awaiting' : a.status;

  const statusConfig: Record<string, { label: string; cls: string }> = {
    awaiting:    { label: '⏳ Awaiting',   cls: 'bg-orange-100 text-orange-700' },
    done:        { label: '✅ Done',        cls: 'bg-green-100 text-green-700' },
    not_done:    { label: '❌ Not Done',    cls: 'bg-red-100 text-red-600' },
    in_progress: { label: '▶ In Progress', cls: 'bg-blue-100 text-blue-700' },
    failed:      { label: '⚠ Failed',      cls: 'bg-red-100 text-red-700' },
    pending:     { label: '● Pending',     cls: 'bg-bg-secondary text-text-secondary' },
  };
  const cfg = statusConfig[effectiveStatus] || statusConfig.pending;

  const hasFormData = a.form_response && Object.keys(a.form_response).length > 0;
  const hasLeadData = a.lead_statuses && Object.keys(a.lead_statuses).length > 0;

  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(a.employee_name)}`}>
          {initials(a.employee_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{a.employee_name}</p>
          <p className="text-xs text-text-secondary font-mono">+{a.employee_number}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Delivery receipts */}
      <div className="px-3 pb-2 flex items-center gap-3 text-xs text-text-secondary pl-[52px] flex-wrap">
        {!a.wa_message_id && !a.wa_failed_reason && (
          <span className="opacity-40">Not sent yet</span>
        )}
        {a.wa_message_id && !a.wa_delivered_at && !a.wa_failed_reason && (
          <span>📤 Sent</span>
        )}
        {a.wa_delivered_at && !a.wa_read_at && (
          <span>✓ Delivered {fmtTime(a.wa_delivered_at)}</span>
        )}
        {a.wa_read_at && (
          <span className="text-blue-500">✓✓ Read {fmtTime(a.wa_read_at)}</span>
        )}
        {a.responded_at && (
          <span className="text-green-600">· replied {fmtTime(a.responded_at)}</span>
        )}
        {a.wa_failed_reason && (
          <span className="text-red-500 max-w-[180px] truncate" title={a.wa_failed_reason}>
            ⚠ {a.wa_failed_reason}
          </span>
        )}
      </div>

      {/* Expandable form/lead response */}
      {(hasFormData || hasLeadData) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-text-secondary bg-bg-secondary border-t border-border-color hover:opacity-80 transition-opacity"
          >
            <span className="font-medium">
              {hasFormData ? 'Form response' : `${Object.keys(a.lead_statuses!).length} leads`}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          {expanded && (
            <div className="px-3 py-2 space-y-1 bg-bg-secondary border-t border-border-color">
              {hasFormData && Object.entries(a.form_response!).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="text-gray-500 font-medium capitalize shrink-0">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-gray-800">{String(v)}</span>
                </div>
              ))}
              {hasLeadData && Object.entries(a.lead_statuses!).map(([leadId, info]) => (
                <div key={leadId} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-mono">{leadId}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                    info.status === 'done' ? 'bg-green-100 text-green-700' :
                    info.status === 'callback' ? 'bg-blue-100 text-blue-700' :
                    'bg-bg-secondary text-text-secondary'
                  }`}>
                    {info.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Action row */}
      {(a.status === 'pending' || a.status === 'failed' || effectiveStatus === 'awaiting' || a.wa_failed_reason) && (
        <div className="flex gap-1.5 px-3 pb-3 pt-1">
          {a.status === 'pending' && (
            <>
              <button
                onClick={() => onStatus(a.id, 'done')}
                className="flex-1 text-xs py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 font-medium transition-colors"
              >
                ✓ Done
              </button>
              <button
                onClick={() => onStatus(a.id, 'not_done')}
                className="flex-1 text-xs py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 font-medium transition-colors"
              >
                ✗ Not Done
              </button>
            </>
          )}
          {(a.status === 'failed' || a.wa_failed_reason) && (
            <button
              onClick={() => onResend(a.id)}
              className="flex items-center gap-1 text-xs py-1.5 px-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Resend
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */

export default function WaWorkPage() {
  /* data */
  const [workItems, setWorkItems] = useState<WaWorkItem[]>([]);
  const [stats, setStats] = useState<WaWorkStats | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [employees, setEmployees] = useState<WaEmployee[]>([]);
  const [groups, setGroups] = useState<WaEmployeeGroup[]>([]);
  const [waSettings, setWaSettings] = useState<WaSettings | null>(null);
  const [contactTypes, setContactTypes] = useState<ContactTypeDef[]>([]);
  const [loading, setLoading] = useState(true);

  /* view mode */
  const [viewMode, setViewMode] = useState<ViewMode>('items');
  const [itemDetailsMap, setItemDetailsMap] = useState<Map<number, WaWorkItem>>(new Map());
  const [detailsLoading,  setDetailsLoading]  = useState(false);

  /* list UI */
  const [statusFilter, setStatusFilter] = useState<WaWorkStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  /* detail */
  const [selectedWork, setSelectedWork] = useState<WaWorkItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);


  /* ─── data loading ─── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, statsData, tmpl, emps, grps, settings, ctypes] = await Promise.all([
        listWorkItems({ status: statusFilter || undefined, per_page: 50 }),
        getWorkStats(),
        listTemplates(),
        listEmployees({ status: 'active' }),
        listGroups(),
        getWaSettings(),
        contactTypesService.list().catch(() => [] as ContactTypeDef[]),
      ]);
      setWorkItems(items.items);
      setStats(statsData);
      setTemplates(tmpl);
      setEmployees(emps);
      setGroups(grps);
      setWaSettings(settings);
      setContactTypes(ctypes);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  /* Load full details (with assignments) for all current work items */
  const loadAllDetails = useCallback(async (items: WaWorkItem[]) => {
    if (items.length === 0) return;
    setDetailsLoading(true);
    try {
      const details = await Promise.all(items.map((i) => getWorkItem(i.id)));
      setItemDetailsMap(new Map(details.map((d) => [d.id, d])));
    } catch {
      // silent
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  /* Load a single item detail on-demand (used by By Template expand) */
  const loadSingleDetail = useCallback(async (id: number) => {
    try {
      const detail = await getWorkItem(id);
      setItemDetailsMap((prev) => new Map(prev).set(id, detail));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── filtering + grouping ─── */
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return workItems;
    const q = searchQuery.toLowerCase();
    return workItems.filter(
      (w) => w.title.toLowerCase().includes(q) || (w.template_name || '').toLowerCase().includes(q),
    );
  }, [workItems, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, WaWorkItem[]>();
    for (const item of filteredItems) {
      const key = item.template_name || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { '': workItems.length };
    for (const item of workItems) c[item.status] = (c[item.status] || 0) + 1;
    return c;
  }, [workItems]);

  /* ─── detail ─── */
  async function openDetail(id: number) {
    setLoadingDetail(true);
    setShowListOnMobile(false);
    try {
      const detail = await getWorkItem(id);
      setSelectedWork(detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDispatch(id: number) {
    try {
      await dispatchWorkItem(id);
      load();
      openDetail(id);
    } catch (e: unknown) {
      alert((e as Error).message || 'Dispatch failed');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this work item?')) return;
    try {
      await deleteWorkItem(id);
      if (selectedWork?.id === id) setSelectedWork(null);
      load();
    } catch { /* silent */ }
  }

  async function handleAssignmentStatus(assignmentId: number, status: AssignmentStatus) {
    try {
      await updateAssignmentStatus(assignmentId, status);
      if (selectedWork) openDetail(selectedWork.id);
    } catch { /* silent */ }
  }

  async function handleResend(assignmentId: number) {
    try {
      await resendAssignment(assignmentId);
      if (selectedWork) openDetail(selectedWork.id);
    } catch { /* silent */ }
  }

  /* ─── compose ─── */
  const handleComposerSent = useCallback(async (created: WaWorkItem) => {
    await load();
    openDetail(created.id);
  }, [load]);

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] min-h-0 w-full bg-bg-secondary">

      {/* ══ PERSISTENT TAB BAR — always visible ══════════════ */}
      <div className="flex items-center justify-between px-3 border-b border-border-color bg-bg-primary shrink-0">
        {/* View tabs — flush with bottom border like nav tabs */}
        <div className="flex">
          {VIEW_TABS.map(({ value, label }) => {
            const isActive = viewMode === value;
            const count =
              value === 'items'
                ? workItems.length
                : value === 'by_employee'
                  ? employees.length
                  : undefined;
            return (
              <button
                key={value}
                onClick={() => {
                  setViewMode(value);
                  // Pre-load all details for the views that need full assignment data.
                  if (value === 'by_employee' || value === 'by_template') {
                    loadAllDetails(workItems);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-color'
                }`}
              >
                <span>{label}</span>
                {typeof count === 'number' && count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-bg-secondary text-text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats + Refresh on the right */}
        <div className="flex items-center gap-3 py-2">
          {stats && (
            <span className="text-[11px] text-text-secondary hidden sm:block">
              {stats.total_work_items} items · {stats.done} done · {stats.completion_rate}% rate
            </span>
          )}
          <button onClick={load} className="p-1 rounded-lg hover:bg-bg-secondary text-text-secondary transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ══ MAIN CONTENT AREA ════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ══ LEFT PANEL ══════════════════════════════════════ */}
      <div className={`${viewMode !== 'items' ? 'hidden' : showListOnMobile ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-[340px] md:shrink-0 border-r border-border-color bg-bg-primary min-h-0`}>

        {/* Filter + Search zone — only in Work Items view */}
        {viewMode === 'items' && (
          <div className="px-3 pt-2 pb-2.5 border-b border-border-color shrink-0 space-y-2">
            {/* Status chips */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {STATUS_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value as WaWorkStatus | '')}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    statusFilter === value
                      ? 'bg-green-600 text-white'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                  {tabCounts[value] != null && (
                    <span className={`ml-1 ${statusFilter === value ? 'opacity-80' : 'opacity-50'}`}>
                      {tabCounts[value]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border-color bg-bg-secondary pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        {/* Work list — only in Work Items view */}
        <div className={`flex-1 overflow-y-auto min-h-0 ${viewMode !== 'items' ? 'hidden' : ''}`}>
          {loading ? (
            <SkeletonList />
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm">
              <MessageSquare className="w-10 h-10 mb-2 opacity-25" />
              <p className="font-medium">No work items</p>
              <p className="text-xs mt-1">Type a task below and hit send</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([groupName, items]) => {
              const isOpen = !collapsedGroups.has(groupName);
              return (
                <div key={groupName}>
                  {/* Group header */}
                  <button
                    onClick={() => setCollapsedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
                      return next;
                    })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-bg-secondary transition-colors"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 text-text-secondary transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary truncate flex-1">
                      {groupName}
                    </span>
                    <span className="text-[10px] text-text-secondary shrink-0">{items.length}</span>
                  </button>

                  {/* Group items */}
                  {isOpen && items.map((item) => {
                    const pct = item.assigned_count
                      ? Math.round((item.done_count / item.assigned_count) * 100)
                      : 0;
                    const allFailed =
                      item.status === 'dispatched' &&
                      item.assigned_count > 0 &&
                      item.pending_count === item.assigned_count &&
                      item.done_count === 0;

                    return (
                      <button
                        key={item.id}
                        onClick={() => openDetail(item.id)}
                        className={`w-full text-left px-4 py-3 border-b border-border-color hover:bg-bg-secondary transition-colors ${
                          selectedWork?.id === item.id
                            ? 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            {/* Status + warning */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[item.status] || 'bg-bg-secondary text-text-secondary'}`}>
                                {item.status === 'dispatched' ? 'Live' : item.status}
                              </span>
                              {allFailed && (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              )}
                            </div>
                            {/* Title */}
                            <p className="text-sm font-medium text-text-primary truncate leading-snug">
                              {item.title}
                            </p>
                            {/* Progress bar + count */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1 bg-bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-text-secondary shrink-0">
                                {item.done_count}/{item.assigned_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* ══ COMPOSE BAR — only in Work Items view ══ */}
        {viewMode === 'items' && (
          <TaskComposer
            employees={employees}
            groups={groups}
            templates={templates}
            contactTypes={contactTypes}
            waSettings={waSettings}
            onSent={handleComposerSent}
          />
        )}
      </div>

      {/* ══ BY EMPLOYEE view — replaces left+right when active ══ */}
      {viewMode === 'by_employee' && (
        <ByEmployeePanel
          employees={employees}
          itemDetailsMap={itemDetailsMap}
          loading={detailsLoading}
          composerProps={{
            employees,
            groups,
            templates,
            contactTypes,
            waSettings,
            onSent: handleComposerSent,
          }}
        />
      )}

      {/* ══ BY TEMPLATE view — replaces left+right when active ══ */}
      {viewMode === 'by_template' && (
        <ByTemplatePanel
          workItems={workItems}
          itemDetailsMap={itemDetailsMap}
          onRequestDetail={loadSingleDetail}
          templates={templates}
          composerProps={{
            employees,
            groups,
            templates,
            contactTypes,
            waSettings,
            onSent: handleComposerSent,
          }}
        />
      )}

      {/* ══ RIGHT PANEL — only in Work Items view ═══════════ */}
      <div className={`${!showListOnMobile ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 ${viewMode !== 'items' ? '!hidden' : ''}`}>

        {/* Empty state */}
        {!selectedWork && !loadingDetail && (
          <div className="flex-1 flex items-center justify-center bg-bg-secondary">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-text-primary">WhatsApp Work Manager</p>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                Type a task in the compose bar on the left and tap Send to assign it to your team via WhatsApp.
              </p>
              {stats && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="bg-card-bg rounded-xl p-3 border border-border-color">
                    <p className="text-xl font-bold text-text-primary">{stats.total_work_items}</p>
                    <p className="text-xs text-text-secondary mt-0.5">Total</p>
                  </div>
                  <div className="bg-card-bg rounded-xl p-3 border border-border-color">
                    <p className="text-xl font-bold text-green-600">{stats.done}</p>
                    <p className="text-xs text-text-secondary mt-0.5">Done</p>
                  </div>
                  <div className="bg-card-bg rounded-xl p-3 border border-border-color">
                    <p className="text-xl font-bold text-blue-600">{stats.completion_rate}%</p>
                    <p className="text-xs text-text-secondary mt-0.5">Rate</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading detail */}
        {loadingDetail && (
          <div className="flex-1 flex items-center justify-center bg-bg-secondary">
            <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Detail view */}
        {selectedWork && !loadingDetail && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* Header */}
            <div className="bg-bg-primary border-b border-border-color px-5 py-4 shrink-0">
              {/* Mobile back */}
              <button
                onClick={() => setShowListOnMobile(true)}
                className="md:hidden flex items-center gap-1 text-sm text-green-600 font-medium mb-3"
              >
                ← Back to list
              </button>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-text-primary leading-tight">{selectedWork.title}</h2>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[selectedWork.status] || 'bg-bg-secondary text-text-secondary'}`}>
                      {selectedWork.status === 'dispatched' ? '🟢 Live' : selectedWork.status}
                    </span>
                    {selectedWork.template_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        📋 {selectedWork.template_name}
                      </span>
                    )}
                    {selectedWork.due_at && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(selectedWork.due_at)}
                      </span>
                    )}
                    {selectedWork.dispatched_at && (
                      <span className="text-xs text-gray-400">
                        Sent {fmtDate(selectedWork.dispatched_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedWork.status === 'draft' && (
                    <button
                      onClick={() => handleDispatch(selectedWork.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedWork.id)}
                    className="p-1.5 rounded-lg border border-border-color text-text-secondary hover:text-red-500 hover:border-red-200 transition-colors"
                    title="Delete work item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {selectedWork.assigned_count > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-green-600 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {selectedWork.done_count} done
                      </span>
                      {selectedWork.awaiting_reply_count > 0 && (
                        <span className="text-orange-500 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {selectedWork.awaiting_reply_count} awaiting
                        </span>
                      )}
                      {selectedWork.failed_count > 0 && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {selectedWork.failed_count} failed
                        </span>
                      )}
                      <span className="text-gray-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {selectedWork.assigned_count} total
                      </span>
                    </div>
                    <span className="font-bold text-text-primary text-sm">
                      {Math.round((selectedWork.done_count / selectedWork.assigned_count) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.round((selectedWork.done_count / selectedWork.assigned_count) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Assignment list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedWork.description && (
                <div className="bg-card-bg rounded-xl border border-border-color px-4 py-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">Note</p>
                  <p className="text-sm text-text-primary">{selectedWork.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-text-secondary tracking-wide">
                  Assignments ({(selectedWork.assignments || []).length})
                </p>
              </div>

              {(selectedWork.assignments || []).length === 0 ? (
                <div className="text-center py-10 text-text-secondary text-sm">
                  No assignments yet
                </div>
              ) : (
                (selectedWork.assignments || []).map((a) => (
                  <AssignmentCard
                    key={a.id}
                    a={a}
                    onStatus={handleAssignmentStatus}
                    onResend={handleResend}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      </div>{/* ── end MAIN CONTENT AREA ── */}
    </div>
  );
}
