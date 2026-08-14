'use client';

import { useState, useMemo, useEffect } from 'react';
import { Users, AlertTriangle, Search, MessageSquare, ClipboardList } from 'lucide-react';
import { formatTime, formatDayMonth } from '@/lib/format-date';
import type { WaEmployee, WaSettings } from '@/services/waEmployees';
import type { WaWorkItem, WaWorkAssignment } from '@/services/waWork';
import type { WaTemplate } from '@/services/waTemplates';
import type { ContactTypeDef } from '@/services/contacts';
import { EmployeeChat } from './employee-chat';
import { TaskComposer } from './task-composer';

type EmployeeTab = 'work' | 'chat';

/** Props the parent page threads through to TaskComposer. */
export interface ComposerSharedProps {
  employees: WaEmployee[];
  templates: WaTemplate[];
  contactTypes: ContactTypeDef[];
  waSettings: WaSettings | null;
  onSent: (workItem: WaWorkItem) => void;
}

/* ── Avatar helpers ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return null;
  return formatTime(iso);
}
function fmtDate(iso: string) {
  return formatDayMonth(iso);
}

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface EmployeeStats {
  employee: WaEmployee;
  totalAssigned: number;
  done: number;
  awaiting: number;
  failed: number;
  pending: number;
  assignments: Array<{ item: WaWorkItem; assignment: WaWorkAssignment }>;
}

interface Props {
  employees: WaEmployee[];
  itemDetailsMap: Map<number, WaWorkItem>;
  loading: boolean;
  /** When provided, a TaskComposer footer is rendered, pre-locked to the selected employee. */
  composerProps?: ComposerSharedProps;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export function ByEmployeePanel({ employees, itemDetailsMap, loading, composerProps }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [activeTab, setActiveTab] = useState<EmployeeTab>('work');

  // Reset to Work tab whenever the selected employee changes — feels less
  // surprising than carrying over the last viewed tab to a different person.
  useEffect(() => {
    setActiveTab('work');
  }, [selectedId]);

  // Auto-select first employee when none is chosen and the roster loads —
  // saves a click on the common case and removes the "blank canvas" feel.
  useEffect(() => {
    if (selectedId !== null || loading || employees.length === 0) return;
    setSelectedId(employees[0].id);
    // intentionally not depending on selectedId to avoid re-selecting after manual unselect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, loading]);

  /* Build per-employee stats from all loaded item details */
  const employeeStats = useMemo((): EmployeeStats[] => {
    const map = new Map<number, EmployeeStats>();

    for (const emp of employees) {
      map.set(emp.id, {
        employee: emp,
        totalAssigned: 0,
        done: 0,
        awaiting: 0,
        failed: 0,
        pending: 0,
        assignments: [],
      });
    }

    for (const item of itemDetailsMap.values()) {
      if (!item.assignments) continue;
      for (const a of item.assignments) {
        if (!map.has(a.employee_id)) {
          // assignment for a deactivated / unlisted employee
          map.set(a.employee_id, {
            employee: {
              id: a.employee_id,
              name: a.employee_name,
              whatsapp_number: a.employee_number,
              status: 'inactive' as const,
              role: '',
              is_active: false,
              contact_id: null,
              created_at: '',
              verified_at: null,
              session_window_expires_at: null,
              session_active: false,
            },
            totalAssigned: 0,
            done: 0,
            awaiting: 0,
            failed: 0,
            pending: 0,
            assignments: [],
          });
        }

        const stats = map.get(a.employee_id)!;
        stats.totalAssigned++;
        stats.assignments.push({ item, assignment: a });

        const effective =
          a.status === 'pending' && a.wa_message_id && !a.responded_at
            ? 'awaiting'
            : a.status;

        if (effective === 'done')          stats.done++;
        else if (effective === 'awaiting') stats.awaiting++;
        else if (a.wa_failed_reason || a.status === 'failed') stats.failed++;
        else                               stats.pending++;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Sort: employees with most active work first
      const aActive = a.awaiting + a.pending;
      const bActive = b.awaiting + b.pending;
      if (bActive !== aActive) return bActive - aActive;
      return b.totalAssigned - a.totalAssigned;
    });
  }, [employees, itemDetailsMap]);

  const filteredStats = useMemo(() => {
    if (!empSearch.trim()) return employeeStats;
    const q = empSearch.toLowerCase();
    return employeeStats.filter(
      ({ employee }) =>
        employee.name.toLowerCase().includes(q) ||
        employee.whatsapp_number.includes(q),
    );
  }, [employeeStats, empSearch]);

  const selected = useMemo(
    () => employeeStats.find((s) => s.employee.id === selectedId) ?? null,
    [employeeStats, selectedId],
  );

  /* Group selected employee assignments */
  const grouped = useMemo(() => {
    if (!selected) return { live: [], done: [], failed: [] };
    const live:   typeof selected.assignments = [];
    const done:   typeof selected.assignments = [];
    const failed: typeof selected.assignments = [];

    for (const a of selected.assignments) {
      const effective =
        a.assignment.status === 'pending' && a.assignment.wa_message_id && !a.assignment.responded_at
          ? 'awaiting'
          : a.assignment.status;

      if (a.assignment.status === 'done') done.push(a);
      else if (a.assignment.wa_failed_reason || a.assignment.status === 'failed') failed.push(a);
      else live.push(a);
    }

    return { live, done, failed };
  }, [selected]);

  /* ── Render ── */
  return (
    <>
      {/* LEFT — Employee roster ─────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-border-color bg-bg-primary min-h-0 w-full md:w-[340px] md:shrink-0">
        <div className="px-3 pt-2.5 pb-2 border-b border-border-color shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {loading ? 'Loading…' : `${employeeStats.length} team member${employeeStats.length !== 1 ? 's' : ''}`}
            </p>
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Search employees…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col gap-1 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-bg-secondary animate-pulse" />
            ))}
          </div>
        ) : filteredStats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-text-secondary text-sm gap-2">
            <Users className="w-8 h-8 opacity-25" />
            <p>{empSearch ? 'No matches' : 'No employees yet'}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredStats.map(({ employee, totalAssigned, done, awaiting, failed, pending }) => {
              const rate      = totalAssigned > 0 ? Math.round((done / totalAssigned) * 100) : null;
              const isSelected = employee.id === selectedId;
              const hasIssues  = failed > 0;

              return (
                <button
                  key={employee.id}
                  onClick={() => setSelectedId(employee.id)}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-border-color hover:bg-bg-secondary transition-colors',
                    isSelected ? 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(employee.name)}`}
                    >
                      {initials(employee.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold text-text-primary truncate leading-tight">
                          {employee.name}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasIssues && (
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                          )}
                          {rate !== null && (
                            <span
                              className={`text-xs font-bold ${
                                rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'
                              }`}
                            >
                              {rate}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini status counts */}
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        {totalAssigned === 0 ? (
                          <span className="text-text-secondary opacity-40">No tasks assigned</span>
                        ) : (
                          <>
                            {done > 0    && <span className="text-green-600">✓ {done}</span>}
                            {awaiting > 0 && <span className="text-orange-500">⏳ {awaiting}</span>}
                            {failed > 0  && <span className="text-red-500">⚠ {failed}</span>}
                            {pending > 0 && <span className="text-gray-400">● {pending}</span>}
                          </>
                        )}
                      </div>

                      {/* Progress bar */}
                      {totalAssigned > 0 && (
                        <div className="mt-1.5 h-1 bg-bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.round((done / totalAssigned) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT — Selected employee's work ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-bg-secondary">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Select an employee</p>
              <p className="text-xs text-text-secondary mt-1 max-w-[200px] mx-auto">
                See all their assigned tasks and individual delivery status
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Employee header */}
            <div className="bg-bg-primary border-b border-border-color px-5 pt-4 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${avatarColor(selected.employee.name)}`}
                >
                  {initials(selected.employee.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-text-primary leading-tight">
                    {selected.employee.name}
                  </h2>
                  <p className="text-xs text-text-secondary font-mono">+{selected.employee.whatsapp_number}</p>
                </div>
              </div>

              {/* Summary stats (Work tab only — keeps Chat tab clean) */}
              {activeTab === 'work' && (
                <>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                    <span className="text-text-secondary">{selected.totalAssigned} assigned</span>
                    <span className="text-green-600 font-medium">✓ {selected.done} done</span>
                    {selected.awaiting > 0 && (
                      <span className="text-orange-500 font-medium">⏳ {selected.awaiting} awaiting</span>
                    )}
                    {selected.failed > 0 && (
                      <span className="text-red-500 font-medium">⚠ {selected.failed} failed</span>
                    )}
                    {selected.pending > 0 && (
                      <span className="text-gray-400">● {selected.pending} pending</span>
                    )}
                  </div>

                  {selected.totalAssigned > 0 && (
                    <div className="mt-2.5 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.round((selected.done / selected.totalAssigned) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Work / Chat tabs */}
              <div className="flex items-center gap-1 mt-4 -mb-px">
                <EmployeeTabButton
                  active={activeTab === 'work'}
                  onClick={() => setActiveTab('work')}
                  icon={<ClipboardList className="w-3.5 h-3.5" />}
                  label="Work"
                  count={selected.totalAssigned || undefined}
                />
                <EmployeeTabButton
                  active={activeTab === 'chat'}
                  onClick={() => setActiveTab('chat')}
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                  label="Chat"
                />
              </div>
            </div>

            {/* Tab body */}
            {activeTab === 'work' ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selected.totalAssigned === 0 ? (
                    <div className="text-center py-12 text-text-secondary text-sm">
                      No tasks assigned to {selected.employee.name} yet — assign one below.
                    </div>
                  ) : (
                    <>
                      {grouped.live.length > 0 && (
                        <AssignmentGroup
                          label="Live"
                          count={grouped.live.length}
                          labelClass="text-text-secondary"
                          items={grouped.live}
                        />
                      )}
                      {grouped.failed.length > 0 && (
                        <AssignmentGroup
                          label="Failed"
                          count={grouped.failed.length}
                          labelClass="text-red-400"
                          items={grouped.failed}
                        />
                      )}
                      {grouped.done.length > 0 && (
                        <AssignmentGroup
                          label="Done"
                          count={grouped.done.length}
                          labelClass="text-green-600"
                          items={grouped.done}
                        />
                      )}
                    </>
                  )}
                </div>
                {composerProps && (
                  <TaskComposer
                    {...composerProps}
                    lockedEmployee={selected.employee}
                    contextKey={selected.employee.id}
                  />
                )}
              </>
            ) : (
              <EmployeeChat employee={selected.employee} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Assignment group + row ─────────────────────────────────────────────────── */

function EmployeeTabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
        active
          ? 'text-green-600 border-green-500'
          : 'text-text-secondary border-transparent hover:text-text-primary',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={[
            'ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
            active ? 'bg-green-100 text-green-800' : 'bg-bg-secondary text-text-secondary',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function AssignmentGroup({
  label, count, labelClass, items,
}: {
  label: string;
  count: number;
  labelClass: string;
  items: Array<{ item: WaWorkItem; assignment: WaWorkAssignment }>;
}) {
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${labelClass}`}>
        {label} ({count})
      </p>
      <div className="space-y-2">
        {items.map(({ item, assignment }) => (
          <AssignmentRow key={assignment.id} item={item} assignment={assignment} />
        ))}
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  awaiting:    { label: '⏳ Awaiting',    cls: 'bg-orange-100 text-orange-800' },
  done:        { label: '✅ Done',         cls: 'bg-green-100 text-green-800'  },
  not_done:    { label: '❌ Not Done',     cls: 'bg-red-100 text-red-600'      },
  in_progress: { label: '▶ In Progress',  cls: 'bg-blue-100 text-blue-800'    },
  failed:      { label: '⚠ Failed',       cls: 'bg-red-100 text-red-800'      },
  pending:     { label: '● Pending',      cls: 'bg-bg-secondary text-text-secondary' },
};

function AssignmentRow({
  item,
  assignment: a,
}: {
  item: WaWorkItem;
  assignment: WaWorkAssignment;
}) {
  const effective =
    a.status === 'pending' && a.wa_message_id && !a.responded_at ? 'awaiting' : a.status;
  const cfg = STATUS_CONFIG[effective] ?? STATUS_CONFIG.pending;

  return (
    <div className="bg-card-bg rounded-xl border border-border-color px-3 py-2.5 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate leading-tight">{item.title}</p>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          {item.template_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
              {item.template_name}
            </span>
          )}
          {item.dispatched_at && (
            <span className="text-[10px] text-text-secondary opacity-50">{fmtDate(item.dispatched_at)}</span>
          )}
        </div>

        {/* Delivery receipts */}
        <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
          {a.wa_read_at ? (
            <span className="text-blue-500">✓✓ Read {fmtTime(a.wa_read_at)}</span>
          ) : a.wa_delivered_at ? (
            <span>✓ Delivered {fmtTime(a.wa_delivered_at)}</span>
          ) : a.wa_message_id ? (
            <span>📤 Sent</span>
          ) : null}
          {a.responded_at && (
            <span className="text-green-600">· replied {fmtTime(a.responded_at)}</span>
          )}
          {a.wa_failed_reason && (
            <span className="text-red-500 truncate max-w-[160px]" title={a.wa_failed_reason}>
              ⚠ {a.wa_failed_reason}
            </span>
          )}
        </div>
      </div>

      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 mt-0.5 ${cfg.cls}`}>
        {cfg.label}
      </span>
    </div>
  );
}
