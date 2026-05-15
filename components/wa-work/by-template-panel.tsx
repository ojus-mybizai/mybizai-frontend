'use client';

import { useState, useMemo, useEffect } from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { WaWorkItem } from '@/services/waWork';
import type { WaTemplate } from '@/services/waTemplates';
import { TaskComposer } from './task-composer';
import type { ComposerSharedProps } from './by-employee-panel';

/* ── Avatar / formatting helpers ────────────────────────────────────────────── */

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
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Status config ──────────────────────────────────────────────────────────── */

const WORK_STATUS_COLORS: Record<string, string> = {
  draft:       'bg-bg-secondary text-text-secondary',
  dispatched:  'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-600',
};

const ASSIGN_STATUS: Record<string, { icon: string; label: string; cls: string }> = {
  awaiting:    { icon: '⏳', label: 'Awaiting',    cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  done:        { icon: '✅', label: 'Done',         cls: 'text-green-700  bg-green-50  border-green-200'  },
  not_done:    { icon: '❌', label: 'Not Done',     cls: 'text-red-600   bg-red-50    border-red-200'     },
  in_progress: { icon: '▶', label: 'In Progress',  cls: 'text-blue-700  bg-blue-50   border-blue-200'    },
  failed:      { icon: '⚠', label: 'Failed',       cls: 'text-red-700   bg-red-50    border-red-200'     },
  pending:     { icon: '●', label: 'Pending',      cls: 'text-text-secondary bg-bg-secondary border-border-color' },
};

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface TemplateGroup {
  name: string;
  items: WaWorkItem[];       // sorted newest first
  totalAssigned: number;
  totalDone: number;
  lastDispatchedAt: string | null;
}

interface Props {
  workItems: WaWorkItem[];
  itemDetailsMap: Map<number, WaWorkItem>;
  onRequestDetail: (id: number) => void;  // page-level loader
  /** Full template catalog — used to resolve the locked template by name. */
  templates?: WaTemplate[];
  /** When provided, a TaskComposer footer is rendered, pre-locked to the selected template. */
  composerProps?: ComposerSharedProps;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export function ByTemplatePanel({
  workItems,
  itemDetailsMap,
  onRequestDetail,
  templates = [],
  composerProps,
}: Props) {
  const [selectedTemplate, setSelectedTemplate]   = useState<string | null>(null);
  const [expandedItemId,   setExpandedItemId]     = useState<number | null>(null);

  /* Group work items by template_name */
  const templateGroups = useMemo((): TemplateGroup[] => {
    const map = new Map<string, WaWorkItem[]>();
    for (const item of workItems) {
      const key = item.template_name || '(No Template)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    return Array.from(map.entries())
      .map(([name, items]) => {
        const sorted = [...items].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const dispatched = sorted.filter((i) => i.dispatched_at);
        return {
          name,
          items: sorted,
          totalAssigned: items.reduce((s, i) => s + i.assigned_count, 0),
          totalDone:     items.reduce((s, i) => s + i.done_count, 0),
          lastDispatchedAt:
            dispatched.length > 0 ? dispatched[0].dispatched_at : null,
        };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [workItems]);

  const selectedGroup = templateGroups.find((g) => g.name === selectedTemplate) ?? null;

  // Auto-select the first template once the catalog loads so the user doesn't
  // land on a blank canvas. They can still navigate to any other template.
  useEffect(() => {
    if (selectedTemplate !== null || templateGroups.length === 0) return;
    setSelectedTemplate(templateGroups[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateGroups]);

  // Resolve the locked template object for TaskComposer — match by name.
  // Falls back to null for the "(No Template)" group, which means "no lock".
  const lockedTemplate = useMemo(() => {
    if (!selectedGroup || selectedGroup.name === '(No Template)') return null;
    return templates.find((t) => t.name === selectedGroup.name) ?? null;
  }, [selectedGroup, templates]);

  function toggleExpand(id: number) {
    if (expandedItemId === id) {
      setExpandedItemId(null);
      return;
    }
    setExpandedItemId(id);
    // If we don't have the full detail for this item yet, request it
    if (!itemDetailsMap.has(id)) {
      onRequestDetail(id);
    }
  }

  /* ── Render ── */
  return (
    <>
      {/* LEFT — Template list ───────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-border-color bg-bg-primary min-h-0 w-full md:w-[340px] md:shrink-0">
        <div className="px-4 py-2.5 border-b border-border-color shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {templateGroups.length} template{templateGroups.length !== 1 ? 's' : ''}
          </p>
        </div>

        {templateGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-text-secondary text-sm gap-2">
            <FileText className="w-8 h-8 opacity-25" />
            <p>No work items yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {templateGroups.map((group) => {
              const rate       = group.totalAssigned > 0
                ? Math.round((group.totalDone / group.totalAssigned) * 100)
                : null;
              const isSelected = group.name === selectedTemplate;
              const noTpl      = group.name === '(No Template)';

              return (
                <button
                  key={group.name}
                  onClick={() => { setSelectedTemplate(group.name); setExpandedItemId(null); }}
                  className={[
                    'w-full text-left px-4 py-3.5 border-b border-border-color hover:bg-bg-secondary transition-colors',
                    isSelected ? 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        noTpl ? 'bg-bg-secondary' : 'bg-purple-50 dark:bg-purple-900/20'
                      }`}
                    >
                      <FileText
                        className={`w-4 h-4 ${noTpl ? 'text-text-secondary' : 'text-purple-600 dark:text-purple-400'}`}
                      />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold text-text-primary truncate">{group.name}</p>
                        {rate !== null && (
                          <span
                            className={`text-xs font-bold shrink-0 ${
                              rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}
                          >
                            {rate}%
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-secondary mt-0.5">
                        {group.items.length} dispatch{group.items.length !== 1 ? 'es' : ''}
                        {' · '}
                        {group.totalDone}/{group.totalAssigned} done
                      </p>

                      {group.totalAssigned > 0 && (
                        <div className="mt-1.5 h-1 bg-bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${Math.round((group.totalDone / group.totalAssigned) * 100)}%`,
                            }}
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

      {/* RIGHT — Template detail with dispatch roster ──────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-bg-secondary">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Select a template</p>
              <p className="text-xs text-text-secondary mt-1 max-w-[200px] mx-auto">
                See each dispatch and the per-employee completion status
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Template header */}
            <div className="bg-bg-primary border-b border-border-color px-5 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedGroup.name === '(No Template)' ? 'bg-bg-secondary' : 'bg-purple-50 dark:bg-purple-900/20'
                  }`}
                >
                  <FileText
                    className={`w-4 h-4 ${
                      selectedGroup.name === '(No Template)' ? 'text-text-secondary' : 'text-purple-600 dark:text-purple-400'
                    }`}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary leading-tight">
                    {selectedGroup.name}
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {selectedGroup.items.length} dispatch{selectedGroup.items.length !== 1 ? 'es' : ''}
                    {' · '}
                    {selectedGroup.totalDone}/{selectedGroup.totalAssigned} done overall
                  </p>
                </div>
              </div>
            </div>

            {/* Dispatch list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedGroup.items.map((item) => {
                const detail     = itemDetailsMap.get(item.id);
                const isExpanded = expandedItemId === item.id;
                const pct        = item.assigned_count > 0
                  ? Math.round((item.done_count / item.assigned_count) * 100)
                  : 0;

                return (
                  <div key={item.id} className="bg-card-bg rounded-xl border border-border-color overflow-hidden">
                    {/* Dispatch row (clickable header) */}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="w-full text-left px-4 py-3 hover:bg-bg-secondary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Status + date */}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[item.status] ?? 'bg-bg-secondary text-text-secondary'}`}
                            >
                              {item.status === 'dispatched' ? 'Live' : item.status}
                            </span>
                            {item.dispatched_at && (
                              <span className="text-xs text-text-secondary">{fmtDate(item.dispatched_at)}</span>
                            )}
                          </div>

                          {/* Title */}
                          <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>

                          {/* Mini stats */}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                            {item.done_count > 0         && <span className="text-green-600">✓ {item.done_count}</span>}
                            {item.awaiting_reply_count > 0 && <span className="text-orange-500">⏳ {item.awaiting_reply_count}</span>}
                            {item.failed_count > 0       && <span className="text-red-500">⚠ {item.failed_count}</span>}
                            {item.pending_count > 0      && <span>● {item.pending_count}</span>}
                          </div>
                        </div>

                        {/* Completion % + expand icon */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`text-sm font-bold ${
                              pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}
                          >
                            {pct}%
                          </span>
                          <span className="text-xs text-text-secondary opacity-50">
                            {item.done_count}/{item.assigned_count}
                          </span>
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-text-secondary mt-0.5" />
                            : <ChevronRight className="w-3.5 h-3.5 text-text-secondary mt-0.5" />
                          }
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>

                    {/* Employee roster table — expanded ──────────────────── */}
                    {isExpanded && (
                      <div className="border-t border-border-color">
                        {!detail ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-xs text-text-secondary">
                            <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                            Loading roster…
                          </div>
                        ) : (detail.assignments ?? []).length === 0 ? (
                          <p className="px-4 py-3 text-xs text-text-secondary text-center">No assignments</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-bg-secondary border-b border-border-color">
                                <tr>
                                  <th className="text-left px-4 py-2 font-semibold text-text-secondary whitespace-nowrap">
                                    Employee
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-text-secondary">Status</th>
                                  <th className="text-left px-4 py-2 font-semibold text-text-secondary hidden sm:table-cell whitespace-nowrap">
                                    Delivered
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-text-secondary hidden sm:table-cell">
                                    Read
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-text-secondary hidden md:table-cell">
                                    Replied
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-color">
                                {(detail.assignments ?? []).map((a) => {
                                  const effective =
                                    a.status === 'pending' && a.wa_message_id && !a.responded_at
                                      ? 'awaiting'
                                      : a.status;
                                  const scfg = ASSIGN_STATUS[effective] ?? ASSIGN_STATUS.pending;

                                  return (
                                    <tr key={a.id} className="hover:bg-bg-secondary transition-colors">
                                      {/* Employee */}
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${avatarColor(a.employee_name)}`}
                                          >
                                            {initials(a.employee_name)}
                                          </div>
                                          <span className="font-medium text-text-primary truncate max-w-[90px]">
                                            {a.employee_name}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Status */}
                                      <td className="px-4 py-2.5">
                                        <span
                                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${scfg.cls}`}
                                        >
                                          {scfg.icon} {scfg.label}
                                        </span>
                                      </td>

                                      {/* Delivered */}
                                      <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">
                                        {fmtTime(a.wa_delivered_at) ?? '—'}
                                      </td>

                                      {/* Read */}
                                      <td className="px-4 py-2.5 hidden sm:table-cell">
                                        {a.wa_read_at ? (
                                          <span className="text-blue-500 font-medium">
                                            ✓✓ {fmtTime(a.wa_read_at)}
                                          </span>
                                        ) : (
                                          <span className="text-text-secondary opacity-30">—</span>
                                        )}
                                      </td>

                                      {/* Replied */}
                                      <td className="px-4 py-2.5 hidden md:table-cell">
                                        {a.responded_at ? (
                                          <span className="text-green-600 font-medium">
                                            {fmtTime(a.responded_at)}
                                          </span>
                                        ) : (
                                          <span className="text-text-secondary opacity-30">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Composer footer — dispatch a new task pre-locked to this template */}
            {composerProps && (
              <TaskComposer
                {...composerProps}
                lockedTemplate={lockedTemplate}
                contextKey={selectedGroup.name}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
