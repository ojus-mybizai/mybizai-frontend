'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { formatDayMonth } from '@/lib/format-date';
import {
  listWork, updateWork, startWork, getWorkTemplate, submitWorkForm,
  getAssignedLeads, updateLeadAssignmentStatus,
  type Work, type WorkLeadAssignment, type FormField,
} from '@/services/work';
import { listEmployees } from '@/services/employees';
import { WorkChatPanel } from '@/components/work/work-chat-panel';
import WorkDetailChecklist from '@/components/work/work-detail-checklist';
import WorkDetailDatasheet from '@/components/work/work-detail-datasheet';
import { DynamicWorkForm } from '@/components/work/dynamic-work-form';
import { SubtaskList } from '@/components/work/subtask-list';
import { DatasheetFormBuilder } from '@/components/work/datasheet-form-builder';
import { QuickTaskModal } from '@/components/work/quick-task-modal';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { createLogEntry } from '@/services/work';
import { useDebounce } from '@/lib/use-debounce';

/* ── constants ──────────────────────────────────────────── */

const STATUS_OPTS = [
  { value: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'completed', label: 'Completed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-gray-100 text-gray-700 border-gray-400 dark:bg-gray-700 dark:text-gray-300' },
] as const;

const PRIORITY_OPTS = [
  { value: 'low', label: 'Low', cls: 'bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'medium', label: 'Medium', cls: 'bg-blue-50 text-blue-800 border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' },
  { value: 'high', label: 'High', cls: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-300' },
] as const;

type TabKey = 'assigned_to_me' | 'assigned_by_me' | 'my_logs' | 'all' | 'pending' | 'in_progress' | 'completed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'assigned_to_me', label: 'Assigned to Me' },
  { key: 'assigned_by_me', label: 'Assigned by Me' },
  { key: 'my_logs', label: 'My Logs' },
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

/* ── helpers ────────────────────────────────────────────── */

function priorityDotColor(p: string) {
  if (p === 'high') return 'bg-red-500';
  if (p === 'medium') return 'bg-amber-400';
  return 'bg-slate-300';
}

function statusLabel(s: string) {
  if (s === 'pending') return 'Pending';
  if (s === 'in_progress') return 'In Progress';
  if (s === 'completed') return 'Completed';
  if (s === 'cancelled') return 'Cancelled';
  return s;
}

function statusBadgeClass(s: string) {
  if (s === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (s === 'in_progress') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (s === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function isOverdue(w: Work) {
  return w.status !== 'completed' && w.status !== 'cancelled' && w.due_date && new Date(w.due_date) < new Date();
}

function formatShortDate(d: string) {
  return formatDayMonth(d);
}

/* ── chevron icon ───────────────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ── skeleton loader ────────────────────────────────────── */

function SkeletonList() {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-2 rounded-lg bg-bg-secondary p-3">
          <div className="h-3.5 w-3/4 rounded bg-border-color" />
          <div className="h-3 w-1/2 rounded bg-border-color" />
        </div>
      ))}
    </div>
  );
}

/* ── calling leads inline component ────────────────────── */

function CallingLeadsList({ workId }: { workId: number }) {
  const [leads, setLeads] = useState<WorkLeadAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssignedLeads(workId)
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workId]);

  if (loading) return <p className="animate-pulse text-center text-sm text-text-secondary py-8">Loading leads...</p>;
  if (leads.length === 0) return <p className="text-center text-sm text-text-secondary py-8">No leads assigned</p>;

  const calledCount = leads.filter((l) => l.status === 'called').length;
  const progress = leads.length > 0 ? (calledCount / leads.length) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">Calling Progress</span>
        <span className="text-sm font-bold text-accent">{calledCount}/{leads.length}</span>
      </div>
      <div className="h-2 rounded-full bg-bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="divide-y divide-border-color rounded-lg border border-border-color">
        {leads.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{a.lead_name || 'Unknown'}</p>
              <p className="text-xs text-text-secondary">{a.lead_phone || 'No phone'}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
              a.status === 'called' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
              a.status === 'skipped' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
              a.status === 'callback' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
              'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {a.status}
            </span>
            {a.status === 'pending' && (
              <button
                onClick={async () => {
                  await updateLeadAssignmentStatus(workId, a.lead_id, 'called');
                  setLeads((prev) => prev.map((l) => (l.id === a.id ? { ...l, status: 'called' } : l)));
                }}
                className="text-xs text-accent hover:underline"
              >
                Mark Called
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────── */

export default function WorkstationPage() {
  /* auth */
  const user = useAuthStore((s) => s.user as Record<string, unknown> | null);
  const defaultRole = useAuthStore((s) => s.defaultRole);
  const isOwner = useAuthStore((s) => s.isOwner);
  const currentUserId = (user?.id as number) ?? 0;
  const currentUserName = (user?.name as string) ?? '';
  const canManageWork = isOwner || defaultRole === 'manager';

  /* state */
  const [allWork, setAllWork] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('assigned_to_me');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [employees, setEmployees] = useState<Array<{ user_id: number; name: string; email: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [assignWorkOpen, setAssignWorkOpen] = useState(false);

  const searchParams = useSearchParams();

  /* right panel tabs */
  const [rightTab, setRightTab] = useState<string>('chat');

  /* template data (loaded when work is selected) */
  const [formSchema, setFormSchema] = useState<FormField[] | null>(null);
  const [stepsSchema, setStepsSchema] = useState<Array<{ order: number; label: string; form_schema?: FormField[] }> | null>(null);
  const [datasheetUiSchema, setDatasheetUiSchema] = useState<Record<string, unknown> | null>(null);
  const [executionRules, setExecutionRules] = useState<Record<string, unknown> | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  /* data fetch — work items (needed for all tabs) */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const workRes = await listWork({ per_page: 200 });
        if (cancelled) return;
        setAllWork(workRes.items);
      } catch (err) {
        console.error('Failed to load workstation data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* employees — deferred until a work item is selected or a modal opens */
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  useEffect(() => {
    if (employeesLoaded) return;
    if (!selectedWorkId && !quickTaskOpen && !assignWorkOpen) return;
    let cancelled = false;
    listEmployees()
      .then((empList) => {
        if (cancelled) return;
        setEmployees(empList.map((e) => ({ user_id: e.user_id, name: e.name, email: e.email })));
        setEmployeesLoaded(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedWorkId, quickTaskOpen, assignWorkOpen, employeesLoaded]);

  /* open work from URL query param ?work=123 */
  useEffect(() => {
    const workParam = searchParams?.get('work');
    if (workParam) {
      const id = Number(workParam);
      if (!Number.isNaN(id)) {
        setSelectedWorkId(id);
        setShowListOnMobile(false);
      }
    }
  }, [searchParams]);

  /* selected work */
  const selectedWork = useMemo(() => allWork.find((w) => w.id === selectedWorkId) || null, [allWork, selectedWorkId]);

  /* load template data when a work item is selected */
  useEffect(() => {
    setFormSchema(null);
    setStepsSchema(null);
    setDatasheetUiSchema(null);
    setExecutionRules(null);
    setRightTab('chat');
    if (!selectedWork?.work_template_id) return;
    setTemplateLoading(true);
    getWorkTemplate(selectedWork.work_template_id)
      .then((t) => {
        if (selectedWork.template_type === 'datasheet') {
          setDatasheetUiSchema((t.datasheet_ui_schema as Record<string, unknown>) ?? null);
        }
        setFormSchema(Array.isArray(t.form_schema) ? (t.form_schema as FormField[]) : null);
        setExecutionRules((t.execution_rules as Record<string, unknown>) ?? null);
        if (Array.isArray(t.steps_schema)) {
          setStepsSchema(
            (t.steps_schema as Array<{ order: number; label: string; form_schema?: unknown[] }>).map((s) => ({
              order: s.order,
              label: s.label,
              form_schema: Array.isArray(s.form_schema) ? (s.form_schema as FormField[]) : undefined,
            })),
          );
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setTemplateLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWork?.id]);

  /* dynamic right panel tabs based on template type */
  const rightTabs = useMemo(() => {
    const tabs: Array<{ key: string; label: string }> = [{ key: 'chat', label: 'Chat' }];
    if (!selectedWork) return tabs;
    const tt = selectedWork.template_type;
    if (tt === 'checklist') tabs.push({ key: 'steps', label: 'Steps' });
    if (tt === 'datasheet') tabs.push({ key: 'records', label: 'Records' });
    if (tt === 'calling') tabs.push({ key: 'leads', label: 'Leads' });
    if (formSchema && formSchema.length > 0) tabs.push({ key: 'form', label: 'Form' });
    tabs.push({ key: 'subtasks', label: 'Subtasks' });
    tabs.push({ key: 'new-record', label: 'New Record' });
    return tabs;
  }, [selectedWork, formSchema]);

  /* client-side filtering */
  const filteredWork = useMemo(() => {
    let items = allWork;
    if (activeTab === 'assigned_to_me') items = items.filter((w) => w.assigned_to_id === currentUserId && (w.template_type as string) !== 'log');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (activeTab === 'assigned_by_me') items = items.filter((w) => (w as any).created_by_id === currentUserId && w.assigned_to_id !== currentUserId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (activeTab === 'my_logs') items = items.filter((w) => (w.template_type as string) === 'log' && (w as any).created_by_id === currentUserId);
    else if (activeTab === 'pending') items = items.filter((w) => w.status === 'pending');
    else if (activeTab === 'in_progress') items = items.filter((w) => w.status === 'in_progress');
    else if (activeTab === 'completed') items = items.filter((w) => w.status === 'completed');
    // 'all' shows everything

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (w) => (w.title || '').toLowerCase().includes(q) || w.work_type_name.toLowerCase().includes(q),
      );
    }
    return items;
  }, [allWork, activeTab, currentUserId, debouncedSearch]);

  /* group by work_type_name */
  const grouped = useMemo(() => {
    const map = new Map<string, Work[]>();
    for (const item of filteredWork) {
      const key = item.template_name || item.work_type_name || 'Uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredWork]);

  /* tab counts */
  const tabCounts = useMemo(() => {
    const counts = { assigned_to_me: 0, assigned_by_me: 0, my_logs: 0, all: allWork.length, pending: 0, in_progress: 0, completed: 0 };
    for (const w of allWork) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa = w as any;
      if (w.assigned_to_id === currentUserId && (w.template_type as string) !== 'log') counts.assigned_to_me++;
      if (wa.created_by_id === currentUserId && w.assigned_to_id !== currentUserId) counts.assigned_by_me++;
      if ((w.template_type as string) === 'log' && wa.created_by_id === currentUserId) counts.my_logs++;
      if (w.status === 'pending') counts.pending++;
      else if (w.status === 'in_progress') counts.in_progress++;
      else if (w.status === 'completed') counts.completed++;
    }
    return counts;
  }, [allWork, currentUserId]);

  /* selected work (kept for backward compat — primary definition moved above template loading) */

  /* helpers */
  const updateItemInList = useCallback((workId: number, updated: Work) => {
    setAllWork((prev) => prev.map((w) => (w.id === workId ? updated : w)));
  }, []);

  const selectItem = useCallback((item: Work) => {
    setSelectedWorkId(item.id);
    setShowListOnMobile(false);
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* actions */
  const handleStart = useCallback(async () => {
    if (!selectedWork || saving) return;
    setSaving(true);
    try {
      const updated = await startWork(selectedWork.id);
      updateItemInList(selectedWork.id, updated);
    } catch (err) {
      console.error('Failed to start work', err);
    } finally {
      setSaving(false);
    }
  }, [selectedWork, saving, updateItemInList]);

  const handleComplete = useCallback(async () => {
    if (!selectedWork || saving) return;
    setSaving(true);
    try {
      const updated = await updateWork(selectedWork.id, { status: 'completed' });
      updateItemInList(selectedWork.id, updated);
    } catch (err) {
      console.error('Failed to complete work', err);
    } finally {
      setSaving(false);
    }
  }, [selectedWork, saving, updateItemInList]);

  const handleStatusChange = useCallback(
    async (status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
      if (!selectedWork || saving) return;
      setSaving(true);
      try {
        const updated = await updateWork(selectedWork.id, { status });
        updateItemInList(selectedWork.id, updated);
      } catch (err) {
        console.error('Failed to update status', err);
      } finally {
        setSaving(false);
      }
    },
    [selectedWork, saving, updateItemInList],
  );

  const handlePriorityChange = useCallback(
    async (priority: 'low' | 'medium' | 'high') => {
      if (!selectedWork || saving) return;
      setSaving(true);
      try {
        const updated = await updateWork(selectedWork.id, { priority });
        updateItemInList(selectedWork.id, updated);
      } catch (err) {
        console.error('Failed to update priority', err);
      } finally {
        setSaving(false);
      }
    },
    [selectedWork, saving, updateItemInList],
  );

  /* ── render ────────────────────────────────────────────── */

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 w-full">
      {/* ── LEFT PANEL ──────────────────────────────────── */}
      <div
        className={`${showListOnMobile ? 'flex' : 'hidden md:flex'} min-h-0 w-full flex-col border-r border-border-color bg-card-bg md:w-[350px] md:shrink-0`}
      >
        {/* header */}
        <div className="px-4 py-3 border-b border-border-color">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-text-primary">Workstation</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setAssignWorkOpen(true)} className="rounded-lg border border-border-color px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
                Assign Work
              </button>
              <button onClick={() => setQuickTaskOpen(true)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                + Quick Task
              </button>
            </div>
          </div>
        </div>

        {/* filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-border-color scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-secondary/80'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-75">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* search */}
        <div className="px-4 py-2.5 border-b border-border-color">
          <input
            type="text"
            placeholder="Search work..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* work list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <SkeletonList />
          ) : filteredWork.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm">
              <svg className="h-10 w-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7.5 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              No work items found
            </div>
          ) : (
            Array.from(grouped.entries()).map(([groupName, items]) => {
              const isOpen = !collapsedGroups.has(groupName);
              return (
                <div key={groupName}>
                  {/* group header */}
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-bg-secondary/50 transition-colors"
                  >
                    <ChevronIcon open={isOpen} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary truncate flex-1">
                      {groupName}
                    </span>
                    <span className="text-[10px] text-text-secondary/70 font-medium">{items.length}</span>
                  </button>

                  {/* group items */}
                  {isOpen &&
                    items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectItem(item)}
                        className={`w-full text-left px-4 py-3 border-b border-border-color hover:bg-bg-secondary transition-colors ${
                          selectedWorkId === item.id ? 'bg-accent/5 border-l-2 border-l-accent' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDotColor(item.priority)}`} />
                          <span className="text-sm font-medium text-text-primary truncate flex-1">
                            {item.title || item.work_type_name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadgeClass(item.status)}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary ml-4">
                          <span>{item.assigned_to_name}</span>
                          {item.due_date && (
                            <span className={isOverdue(item) ? 'text-red-500 font-medium' : ''}>
                              {formatShortDate(item.due_date)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────── */}
      <div
        className={`${!showListOnMobile ? 'flex' : 'hidden md:flex'} min-h-0 flex-1 flex-col bg-bg-primary`}
      >
        {!selectedWork ? (
          /* empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-text-secondary/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-text-secondary mt-2 text-sm">Select a work item to view details</p>
            </div>
          </div>
        ) : (
          <>
            {/* work detail header */}
            <div className="px-5 py-4 border-b border-border-color space-y-3 shrink-0">
              {/* mobile back */}
              <button
                onClick={() => setShowListOnMobile(true)}
                className="md:hidden flex items-center gap-1 text-sm text-accent font-medium mb-1"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* title */}
              <h2 className="text-lg font-bold text-text-primary">
                {selectedWork.title || selectedWork.work_type_name}
              </h2>

              {/* status pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-text-secondary mr-1">Status</span>
                {STATUS_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    disabled={saving}
                    onClick={() => handleStatusChange(opt.value as 'pending' | 'in_progress' | 'completed' | 'cancelled')}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                      selectedWork.status === opt.value
                        ? `${opt.cls} border-current`
                        : 'border-border-color text-text-secondary/60 hover:border-text-secondary/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* priority pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-text-secondary mr-1">Priority</span>
                {PRIORITY_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    disabled={saving}
                    onClick={() => handlePriorityChange(opt.value as 'low' | 'medium' | 'high')}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                      selectedWork.priority === opt.value
                        ? `${opt.cls} border-current`
                        : 'border-border-color text-text-secondary/60 hover:border-text-secondary/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* meta row */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                <span>
                  Assigned to <strong className="text-text-primary">{selectedWork.assigned_to_name}</strong>
                </span>
                {selectedWork.due_date && (
                  <span>
                    Due <strong className="text-text-primary">{formatShortDate(selectedWork.due_date)}</strong>
                  </span>
                )}
                {isOverdue(selectedWork) && <span className="text-red-500 font-medium">Overdue</span>}

                {/* action buttons */}
                {selectedWork.status === 'pending' && (
                  <button
                    onClick={handleStart}
                    disabled={saving}
                    className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Starting...' : 'Start Work'}
                  </button>
                )}
                {selectedWork.status === 'in_progress' && (
                  <button
                    onClick={handleComplete}
                    disabled={saving}
                    className="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Mark Complete'}
                  </button>
                )}
              </div>
            </div>

            {/* tab bar */}
            <div className="flex border-b border-border-color px-2 overflow-x-auto shrink-0">
              {rightTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setRightTab(tab.key)}
                  className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    rightTab === tab.key
                      ? 'text-accent'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                  {rightTab === tab.key && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>

            {/* tab content */}
            <div className="flex-1 min-h-0 flex flex-col">
              {templateLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-color border-t-accent" />
                </div>
              )}

              {rightTab === 'chat' && (
                <WorkChatPanel
                  workId={selectedWork.id}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  canManageWork={canManageWork}
                  employees={employees}
                />
              )}

              {rightTab === 'steps' && selectedWork.template_type === 'checklist' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <WorkDetailChecklist
                    work={selectedWork}
                    onWorkUpdated={(updated) => updateItemInList(updated.id, updated)}
                    stepsSchema={stepsSchema}
                    globalFormSchema={formSchema}
                  />
                </div>
              )}

              {rightTab === 'records' && selectedWork.template_type === 'datasheet' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <WorkDetailDatasheet
                    work={selectedWork}
                    onWorkUpdated={(updated) => updateItemInList(updated.id, updated)}
                    uiSchema={datasheetUiSchema ?? undefined}
                    formSchema={datasheetUiSchema && (datasheetUiSchema as { form_mode?: string }).form_mode === 'per_record' ? formSchema : undefined}
                  />
                </div>
              )}

              {rightTab === 'form' && formSchema && formSchema.length > 0 && (
                <div className="flex-1 overflow-y-auto p-4">
                  <DynamicWorkForm
                    fields={formSchema}
                    initialValues={(selectedWork.form_data as Record<string, unknown>) ?? {}}
                    onSubmit={async (values) => {
                      let updated = await submitWorkForm(selectedWork.id, values);
                      if (
                        executionRules?.auto_complete_on_form_submit === true &&
                        updated.status !== 'completed' &&
                        updated.status !== 'cancelled'
                      ) {
                        updated = await updateWork(selectedWork.id, { status: 'completed' });
                      }
                      updateItemInList(updated.id, updated);
                    }}
                    submitLabel={
                      selectedWork.form_data && Object.keys(selectedWork.form_data as object).length > 0
                        ? 'Update Form'
                        : 'Submit Form'
                    }
                  />
                </div>
              )}

              {rightTab === 'leads' && selectedWork.template_type === 'calling' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <CallingLeadsList workId={selectedWork.id} />
                </div>
              )}

              {rightTab === 'subtasks' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <SubtaskList
                    workId={selectedWork.id}
                    workTypeId={selectedWork.work_type_id}
                    canEdit={canManageWork || selectedWork.assigned_to_id === currentUserId}
                    employees={employees.map((e) => ({ user_id: e.user_id, name: e.name }))}
                  />
                </div>
              )}

              {rightTab === 'new-record' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <DatasheetFormBuilder />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <QuickTaskModal
        isOpen={quickTaskOpen}
        onClose={() => setQuickTaskOpen(false)}
        onCreated={() => { /* reload work list */ }}
        employees={employees.map(e => ({ user_id: e.user_id, name: e.name }))}
      />

      <AssignWorkModal
        isOpen={assignWorkOpen}
        onClose={() => setAssignWorkOpen(false)}
        onCreated={() => { /* reload */ window.location.reload(); }}
      />
    </div>
  );
}
