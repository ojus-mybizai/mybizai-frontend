'use client';

/**
 * View bodies for the inbox ContactRail.
 *
 * Each exported view component receives ViewProps and renders one focused
 * "page" of the rail (summary, list, compose, edit). Only ONE view is
 * mounted at a time — see contact-rail.tsx for the router.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, Loader2, ChevronDown, Check, Trash2,
  StickyNote, Bell, GitBranch, Activity as ActivityIcon, MessageSquare, BarChart3,
  Bot, UserCheck, UserX, User2, Flame, ExternalLink, Calendar, Megaphone,
  TrendingUp, Database, Table2,
} from 'lucide-react';
import {
  contactsV2Service,
  type Contact as ContactV2,
  type ContactNote,
  type ContactActivity,
  type ContactProcessEntry,
  type Priority,
  type RoutingMode,
} from '@/services/contacts-v2';
import { listEmployees, type WaEmployee } from '@/services/waEmployees';
import { formatDate, formatDateTime, formatDayMonth } from '@/lib/format-date';
import { AddToPipelineModal } from '@/components/contacts/add-to-pipeline-modal';
import { moveEntry, type ProcessEntryWithProcess } from '@/services/processes';
import { getTemplateDatasheetSources, type DatasheetSource } from '@/services/message-templates';
import { queryRecords } from '@/services/dynamic-data';
import {
  type ViewProps,
  type ContactFollowUp,
  type NoteCategoryStr,
  BTN, PRIORITY_META, ROUTING_META, CHANNEL_EMOJI, ACTIVITY_EMOJI, NOTE_CATEGORIES,
  fetchFollowUps, createFollowUp,
  getInitials, formatRelativeTime, formatDuration, formatCurrency,
} from './contact-rail-common';

/* ─── Map iconName → component (decouples common.ts from JSX) ──────── */

const ROUTING_ICONS = { Bot, UserCheck, UserX } as const;

/* ═══════════════════════════════════════════════════════════════════════
   SHARED — sub-header for non-summary views
   ═══════════════════════════════════════════════════════════════════════ */

function SubHeader({
  title, count, onBack, action,
}: {
  title: string;
  count?: number;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-card-bg border-b border-border-color">
      <button
        type="button"
        onClick={onBack}
        title="Back"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${BTN}`}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h3 className="flex-1 min-w-0 text-sm font-semibold text-text-primary truncate">
        {title}
        {count != null && count > 0 && (
          <span className="ml-1.5 text-xs font-medium text-text-secondary">({count})</span>
        )}
      </h3>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED — generic chip-with-popover trigger (used by status chips)
   ═══════════════════════════════════════════════════════════════════════ */

function ChipPopover({
  triggerLabel, triggerClasses, children, alignRight = false,
}: {
  triggerLabel: React.ReactNode;
  triggerClasses?: string;
  children: (close: () => void) => React.ReactNode;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${BTN} ${triggerClasses ?? 'border-border-color bg-bg-secondary text-text-primary hover:bg-card-bg'}`}
      >
        {triggerLabel}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className={`absolute top-full z-30 mt-1 min-w-[180px] rounded-lg border border-border-color bg-card-bg shadow-lg py-1 ${alignRight ? 'right-0' : 'left-0'}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SUMMARY VIEW — the scanning view (default)
   ═══════════════════════════════════════════════════════════════════════ */

function StatusRow({
  label, children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] uppercase tracking-wide font-semibold text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

function PriorityChip({ contact, setContact }: { contact: ContactV2; setContact: (c: ContactV2) => void }) {
  const safePriority: Priority = (PRIORITY_META[contact.priority] ? contact.priority : 'medium') as Priority;
  const meta = PRIORITY_META[safePriority];
  const [updating, setUpdating] = useState(false);
  const update = async (p: Priority, close: () => void) => {
    if (p === contact.priority) { close(); return; }
    setUpdating(true);
    try {
      const next = await contactsV2Service.update(contact.id, { priority: p });
      setContact(next);
    } finally {
      setUpdating(false);
      close();
    }
  };
  return (
    <ChipPopover
      alignRight
      triggerLabel={
        <>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          <span>{updating ? 'Updating…' : meta.label}</span>
        </>
      }
      triggerClasses={meta.pill}
    >
      {(close) => (
        <>
          {(Object.keys(PRIORITY_META) as Priority[]).map((p) => {
            const m = PRIORITY_META[p];
            const active = p === contact.priority;
            return (
              <button
                key={p}
                type="button"
                onClick={() => update(p, close)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${BTN}`}
              >
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                <span className={`flex-1 ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}>{m.label}</span>
                {active && <Check className="h-3 w-3 text-accent" />}
              </button>
            );
          })}
        </>
      )}
    </ChipPopover>
  );
}

function RoutingChip({
  contact, setContact, agents, setView,
}: {
  contact: ContactV2;
  setContact: (c: ContactV2) => void;
  agents: ViewProps['agents'];
  setView: (v: ViewProps['view']) => void;
}) {
  const safeMode: RoutingMode = (ROUTING_META[contact.routing_mode] ? contact.routing_mode : 'manual') as RoutingMode;
  const meta = ROUTING_META[safeMode];
  const Icon = ROUTING_ICONS[meta.iconName];
  const agentName = agents.find((a) => a.id === contact.ai_agent_id)?.name ?? null;
  const [updating, setUpdating] = useState(false);

  const setMode = async (mode: RoutingMode, close: () => void) => {
    if (mode === contact.routing_mode && mode !== 'ai') { close(); return; }
    setUpdating(true);
    try {
      const next = await contactsV2Service.updateRouting(
        contact.id,
        mode,
        mode === 'ai' ? (contact.ai_agent_id ?? agents[0]?.id ?? null) : null,
      );
      setContact(next);
    } finally {
      setUpdating(false);
      close();
    }
  };

  return (
    <ChipPopover
      alignRight
      triggerLabel={
        <>
          <Icon className="h-3 w-3" />
          <span>
            {updating ? 'Updating…' : meta.label}
            {contact.routing_mode === 'ai' && agentName && (
              <span className="ml-1 opacity-80">· {agentName.length > 10 ? agentName.slice(0, 10) + '…' : agentName}</span>
            )}
          </span>
        </>
      }
      triggerClasses={meta.pill}
    >
      {(close) => (
        <>
          {(Object.keys(ROUTING_META) as RoutingMode[]).map((m) => {
            const md = ROUTING_META[m];
            const Mi = ROUTING_ICONS[md.iconName];
            const active = m === contact.routing_mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m, close)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${BTN}`}
              >
                <Mi className="h-3 w-3 text-text-secondary" />
                <span className={`flex-1 ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}>{md.label}</span>
                {active && <Check className="h-3 w-3 text-accent" />}
              </button>
            );
          })}
          {contact.routing_mode === 'ai' && (
            <>
              <div className="my-1 border-t border-border-color" />
              <button
                type="button"
                onClick={() => { close(); setView('edit-routing'); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${BTN}`}
              >
                <Bot className="h-3 w-3" />
                <span>Change AI agent…</span>
              </button>
            </>
          )}
        </>
      )}
    </ChipPopover>
  );
}

function AssigneeChip({
  contact, setContact,
}: {
  contact: ContactV2;
  setContact: (c: ContactV2) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => listEmployees(),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const assign = async (id: number | null, close: () => void) => {
    setOpen(false);
    const next = await contactsV2Service.assign(contact.id, id);
    setContact(next);
    close();
  };

  return (
    <ChipPopover
      alignRight
      triggerLabel={
        <>
          <User2 className="h-3 w-3" />
          <span>{contact.assigned_wa_employee_name ?? 'Unassigned'}</span>
        </>
      }
    >
      {(close) => {
        setTimeout(() => setOpen(true), 0); // trigger employees fetch
        return (
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => assign(null, close)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${BTN} ${contact.assigned_wa_employee_id == null ? 'font-semibold text-accent' : 'text-text-primary'}`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-bg-secondary text-[9px] text-text-secondary">—</span>
              <span className="flex-1">Unassigned</span>
              {contact.assigned_wa_employee_id == null && <Check className="h-3 w-3 text-accent" />}
            </button>
            <div className="my-1 border-t border-border-color" />
            {employees.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-secondary">No employees</p>
            ) : (
              employees.filter((e: WaEmployee) => e.is_active && e.status === 'active').map((e: WaEmployee) => {
                const active = contact.assigned_wa_employee_id === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => assign(e.id, close)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${BTN}`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">
                      {getInitials(e.name, e.whatsapp_number)}
                    </span>
                    <span className={`flex-1 truncate ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}>
                      {e.name || e.whatsapp_number}
                    </span>
                    {active && <Check className="h-3 w-3 text-accent" />}
                  </button>
                );
              })
            )}
          </div>
        );
      }}
    </ChipPopover>
  );
}

function CountTile({
  Icon, count, label, accent, onClick,
}: {
  Icon: typeof StickyNote;
  count: number;
  label: string;
  accent?: 'normal' | 'danger';
  onClick: () => void;
}) {
  const danger = accent === 'danger' && count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2.5 transition-colors ${BTN} ${
        danger
          ? 'border-red-500/30 bg-red-500/8 hover:bg-red-500/15'
          : 'border-border-color bg-card-bg hover:border-accent/40 hover:bg-accent/5'
      }`}
    >
      <Icon className={`h-4 w-4 ${danger ? 'text-red-600 dark:text-red-300' : 'text-text-secondary'}`} />
      <span className={`text-base font-bold leading-none ${danger ? 'text-red-600 dark:text-red-300' : 'text-text-primary'}`}>
        {count}
      </span>
      <span className={`text-[10px] leading-tight ${danger ? 'text-red-600 dark:text-red-300' : 'text-text-secondary'}`}>
        {label}
      </span>
    </button>
  );
}

export function SummaryView({
  contact, setContact, setView, agents, conversations,
}: ViewProps) {
  /* Lazy counts — small parallel queries, all cached */
  const { data: notes = [] } = useQuery({
    queryKey: ['contact-v2', contact.id, 'notes'],
    queryFn: () => contactsV2Service.getNotes(contact.id),
    staleTime: 30_000,
  });
  const { data: followups = [] } = useQuery({
    queryKey: ['contact-v2', contact.id, 'followups'],
    queryFn: () => fetchFollowUps(contact.id),
    staleTime: 30_000,
  });
  const { data: processes = [] } = useQuery({
    queryKey: ['contact-v2', contact.id, 'processes'],
    queryFn: () => contactsV2Service.getProcesses(contact.id),
    staleTime: 30_000,
  });
  const { data: activities = [] } = useQuery({
    queryKey: ['contact-v2', contact.id, 'activities'],
    queryFn: () => contactsV2Service.getActivities(contact.id, 5),
    staleTime: 60_000,
  });

  const pendingFu = followups.filter((f) => f.status === 'scheduled' || f.status === 'pending_manual');
  const overdueFu = pendingFu.filter((f) => new Date(f.scheduled_at).getTime() < Date.now()).length;
  const activeProcs = processes.filter((p) => p.status === 'active');
  const crossChannel = conversations.filter((c) => c.contactId === contact.id).length;

  // Cheap count of linked datasheet records (sum across all sheets with a contact relation).
  const { data: dataCounts } = useQuery({
    queryKey: ['contact-v2', contact.id, 'data-records-count'],
    queryFn: () => fetchLinkedRecordCounts(contact.id),
    staleTime: 60_000,
  });
  const dataRecordCount = dataCounts?.total ?? 0;

  const primaryProc = activeProcs[0];

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
      {/* Status row card */}
      <div className="rounded-lg bg-card-bg border border-border-color px-3 py-1">
        <StatusRow label="Priority">
          <PriorityChip contact={contact} setContact={setContact} />
        </StatusRow>
        <div className="h-px bg-border-color/60" />
        <StatusRow label="Routing">
          <RoutingChip contact={contact} setContact={setContact} agents={agents} setView={setView} />
        </StatusRow>
        <div className="h-px bg-border-color/60" />
        <StatusRow label="Assigned">
          <AssigneeChip contact={contact} setContact={setContact} />
        </StatusRow>
      </div>

      {/* Count tiles */}
      <div className="grid grid-cols-5 gap-1.5">
        <CountTile Icon={StickyNote} count={notes.length}    label="Notes"     onClick={() => setView('notes')} />
        <CountTile Icon={Bell}       count={pendingFu.length} label="Follow-ups" accent={overdueFu > 0 ? 'danger' : 'normal'} onClick={() => setView('followups')} />
        <CountTile Icon={GitBranch}  count={activeProcs.length} label="Pipelines" onClick={() => setView('pipeline')} />
        <CountTile Icon={MessageSquare} count={crossChannel} label="Convos"    onClick={() => setView('conversations')} />
        <CountTile Icon={Database}   count={dataRecordCount} label="Data"       onClick={() => setView('data')} />
      </div>

      {/* Active pipeline summary (top-level snapshot) */}
      {primaryProc && (
        <div className="rounded-lg bg-card-bg border border-border-color px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-text-secondary">
              {activeProcs.length > 1 ? `Active deals (${activeProcs.length})` : 'Active deal'}
            </span>
            <button
              type="button"
              onClick={() => setView('pipeline')}
              className={`text-[11px] font-semibold text-accent hover:underline ${BTN} rounded`}
            >
              View all
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {primaryProc.process_color && (
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: primaryProc.process_color }} />
            )}
            <span className="text-xs font-medium text-text-primary truncate flex-1">{primaryProc.process_name}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: `${primaryProc.current_stage_color ?? 'var(--accent)'}1A`,
                borderColor: `${primaryProc.current_stage_color ?? 'var(--accent)'}44`,
                color: primaryProc.current_stage_color ?? undefined,
              }}
            >
              {primaryProc.current_stage_name ?? '—'}
            </span>
            {primaryProc.expected_value != null && (
              <span className="text-[11px] text-text-secondary">{formatCurrency(primaryProc.expected_value)}</span>
            )}
            {primaryProc.expected_close_date && (
              <span className="text-[11px] text-text-secondary">
                · close {formatDayMonth(primaryProc.expected_close_date)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div className="rounded-lg bg-card-bg border border-border-color px-3 py-2.5">
          <span className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1.5">
            Tags ({contact.tags.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: t.color ? `${t.color}1A` : 'var(--bg-secondary)',
                  borderColor: t.color ? `${t.color}44` : 'var(--border-color)',
                  color: t.color ?? undefined,
                }}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ad attribution one-liner */}
      {(contact.ad_platform || contact.meta_campaign_name || contact.ad_headline) && (
        <div className="rounded-lg bg-card-bg border border-border-color px-3 py-2 flex items-start gap-2">
          <Megaphone className="h-3.5 w-3.5 text-text-secondary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary">
              From ad
            </span>
            <p className="text-xs text-text-primary truncate">
              {contact.meta_campaign_name || contact.ad_headline || contact.ad_platform}
            </p>
          </div>
        </div>
      )}

      {/* Recent activity teaser */}
      <div className="rounded-lg bg-card-bg border border-border-color px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-text-secondary">Recent activity</span>
          <button
            type="button"
            onClick={() => setView('activity')}
            className={`text-[11px] font-semibold text-accent hover:underline ${BTN} rounded`}
          >
            View all
          </button>
        </div>
        {activities.length === 0 ? (
          <p className="text-xs text-text-secondary py-1">No activity yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {activities.slice(0, 3).map((a: ContactActivity) => (
              <li key={a.id} className="flex items-start gap-2 text-xs">
                <span className="text-[12px] leading-none mt-0.5">{ACTIVITY_EMOJI[a.activity_type] ?? '🔹'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary leading-tight truncate">
                    {a.description ?? a.activity_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] text-text-secondary leading-tight mt-0.5">
                    {a.user_name && <span>{a.user_name} · </span>}
                    {formatRelativeTime(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer link */}
      <Link
        href={`/contacts/${contact.id}`}
        className={`flex items-center justify-center gap-1.5 w-full rounded-lg border border-border-color bg-card-bg px-3 py-2.5 text-xs font-medium text-text-secondary hover:text-accent hover:border-accent/40 transition-colors ${BTN}`}
      >
        <ExternalLink className="h-3 w-3" />
        Open full contact profile
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NOTES VIEW (list)
   ═══════════════════════════════════════════════════════════════════════ */

export function NotesView({ contact, setView }: ViewProps) {
  const qc = useQueryClient();
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['contact-v2', contact.id, 'notes'],
    queryFn: () => contactsV2Service.getNotes(contact.id),
    staleTime: 30_000,
  });

  const handleDelete = async (noteId: number) => {
    await contactsV2Service.deleteNote(contact.id, noteId);
    qc.setQueryData(['contact-v2', contact.id, 'notes'], (prev: ContactNote[] = []) => prev.filter((n) => n.id !== noteId));
  };

  return (
    <div className="flex flex-col h-full">
      <SubHeader
        title="Notes"
        count={notes.length}
        onBack={() => setView('summary')}
        action={
          <button
            type="button"
            onClick={() => setView('compose-note')}
            className={`inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <StickyNote className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">No notes yet</p>
            <button
              type="button"
              onClick={() => setView('compose-note')}
              className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
            >
              <Plus className="h-3 w-3" />
              Add the first note
            </button>
          </div>
        ) : (
          notes.map((n: ContactNote) => (
            <div key={n.id} className="group rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  title="Delete note"
                  className={`opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-all ${BTN}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {n.source === 'ai' && (
                  <span className="rounded bg-accent/10 px-1 text-[9px] uppercase font-bold text-accent">AI</span>
                )}
                {n.category && n.category !== 'general' && (
                  <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] capitalize text-text-secondary">
                    {n.category}
                  </span>
                )}
                {n.user_name && <span className="text-[10px] text-text-secondary">{n.user_name}</span>}
                <span className="text-[10px] text-text-secondary/70">· {formatRelativeTime(n.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSE NOTE VIEW (focused form)
   ═══════════════════════════════════════════════════════════════════════ */

export function ComposeNoteView({ contact, setView }: ViewProps) {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategoryStr>('general');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      const note = await contactsV2Service.addNote(contact.id, { content: content.trim(), category });
      qc.setQueryData(['contact-v2', contact.id, 'notes'], (prev: ContactNote[] = []) => [note, ...prev]);
      setView('notes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Add note" onBack={() => setView('notes')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1.5">Note</label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            placeholder="What's important about this customer? Add context for the team or for future AI conversations."
            className={`w-full rounded-lg border border-border-color bg-card-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary resize-none ${BTN}`}
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1.5">Category</label>
          <div className="grid grid-cols-2 gap-1.5">
            {NOTE_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${BTN} ${
                    active
                      ? 'border-accent bg-accent/10 text-accent font-semibold'
                      : 'border-border-color bg-card-bg text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-border-color bg-card-bg px-4 py-3 flex gap-2">
        <button
          type="button"
          onClick={() => setView('notes')}
          className={`flex-1 rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors ${BTN}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className={`flex-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity ${BTN}`}
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FOLLOW-UPS VIEW (list)
   ═══════════════════════════════════════════════════════════════════════ */

export function FollowupsView({ contact, setView }: ViewProps) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['contact-v2', contact.id, 'followups'],
    queryFn: () => fetchFollowUps(contact.id),
    staleTime: 30_000,
  });

  // Order: overdue first, then upcoming, then sent
  const sorted = useMemo(() => {
    const pending = items.filter((f) => f.status === 'scheduled' || f.status === 'pending_manual');
    const done    = items.filter((f) => !(f.status === 'scheduled' || f.status === 'pending_manual'));
    pending.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return { pending, done };
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <SubHeader
        title="Follow-ups"
        count={sorted.pending.length}
        onBack={() => setView('summary')}
        action={
          <button
            type="button"
            onClick={() => setView('compose-followup')}
            className={`inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
          >
            <Plus className="h-3 w-3" />
            Schedule
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Bell className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">No follow-ups scheduled</p>
            <button
              type="button"
              onClick={() => setView('compose-followup')}
              className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
            >
              <Plus className="h-3 w-3" />
              Schedule the first follow-up
            </button>
          </div>
        ) : (
          <>
            {sorted.pending.length > 0 && (
              <p className="text-[10px] uppercase tracking-wide font-bold text-text-secondary px-1">Pending</p>
            )}
            {sorted.pending.map((fu) => {
              const overdue = new Date(fu.scheduled_at).getTime() < Date.now();
              return (
                <div
                  key={fu.id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    overdue
                      ? 'border-red-500/30 bg-red-500/8'
                      : 'border-border-color bg-card-bg'
                  }`}
                >
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{fu.message_text}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                      overdue
                        ? 'border-red-500/30 bg-red-500/12 text-red-600 dark:text-red-300'
                        : 'border-border-color bg-bg-secondary text-text-secondary'
                    }`}>
                      <Bell className="h-2.5 w-2.5" />
                      {overdue ? 'Overdue' : 'Scheduled'}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {formatDateTime(fu.scheduled_at)}
                    </span>
                    {fu.channel_type && (
                      <span className="text-[10px] text-text-secondary capitalize">· {fu.channel_type}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {sorted.done.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide font-bold text-text-secondary px-1 pt-3">Done</p>
                {sorted.done.map((fu) => (
                  <div key={fu.id} className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2 opacity-70">
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap truncate">{fu.message_text}</p>
                    <p className="text-[10px] text-text-secondary mt-1 capitalize">
                      {fu.status.replace('_', ' ')} · {formatRelativeTime(fu.sent_at ?? fu.scheduled_at)}
                    </p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSE FOLLOW-UP VIEW (focused form)
   ═══════════════════════════════════════════════════════════════════════ */

function quickDate(hoursAhead: number): string {
  const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
  // Format as datetime-local: YYYY-MM-DDThh:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComposeFollowupView({ contact, setView }: ViewProps) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [when, setWhen] = useState(quickDate(24));
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!text.trim() || !when || saving) return;
    setSaving(true);
    try {
      const iso = new Date(when).toISOString();
      const created = await createFollowUp(contact.id, {
        message_text: text.trim(),
        scheduled_at: iso,
        delivery_mode: 'manual',
      });
      qc.setQueryData(['contact-v2', contact.id, 'followups'], (prev: ContactFollowUp[] = []) => [...prev, created]);
      setView('followups');
    } finally {
      setSaving(false);
    }
  };

  const quickOptions: { label: string; hours: number }[] = [
    { label: 'In 1 hour',  hours: 1 },
    { label: 'Tomorrow',   hours: 24 },
    { label: 'In 3 days',  hours: 72 },
    { label: 'Next week',  hours: 168 },
  ];

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Schedule follow-up" onBack={() => setView('followups')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1.5">Message</label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="What should the message say?"
            className={`w-full rounded-lg border border-border-color bg-card-bg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary resize-none ${BTN}`}
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1.5">When</label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {quickOptions.map((q) => {
              const active = when === quickDate(q.hours);
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setWhen(quickDate(q.hours))}
                  className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${BTN} ${
                    active
                      ? 'border-accent bg-accent/10 text-accent font-semibold'
                      : 'border-border-color bg-card-bg text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className={`w-full rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary ${BTN}`}
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-border-color bg-card-bg px-4 py-3 flex gap-2">
        <button
          type="button"
          onClick={() => setView('followups')}
          className={`flex-1 rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors ${BTN}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || !when || saving}
          className={`flex-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity ${BTN}`}
        >
          {saving ? 'Scheduling…' : 'Schedule'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PIPELINE VIEW (detail + stage mover)
   ═══════════════════════════════════════════════════════════════════════ */

export function PipelineView({ contact, setView }: ViewProps) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpenId, setMoveOpenId] = useState<number | null>(null);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['contact-v2', contact.id, 'processes'],
    queryFn: () => contactsV2Service.getProcesses(contact.id),
    staleTime: 30_000,
  });

  const active = entries.filter((e: ContactProcessEntry) => e.status === 'active');

  const handleStageMove = async (entry: ContactProcessEntry, stageId: number) => {
    setMoveOpenId(null);
    try {
      const updated = await moveEntry(entry.process_id, entry.id, stageId);
      qc.setQueryData(['contact-v2', contact.id, 'processes'], (prev: ContactProcessEntry[] = []) =>
        prev.map((e) => e.id === entry.id ? { ...e, ...(updated as ProcessEntryWithProcess) } : e),
      );
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-col h-full">
      <SubHeader
        title="Pipelines"
        count={active.length}
        onBack={() => setView('summary')}
        action={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className={`inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <GitBranch className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">Not in any pipeline</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 ${BTN}`}
            >
              <Plus className="h-3 w-3" />
              Add to a pipeline
            </button>
          </div>
        ) : (
          entries.map((e: ContactProcessEntry) => {
            const stageColor = e.current_stage_color ?? 'var(--accent)';
            const moveOpen = moveOpenId === e.id;
            return (
              <div key={e.id} className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                  {e.process_color && (
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.process_color }} />
                  )}
                  <p className="text-xs font-semibold text-text-primary truncate flex-1">{e.process_name}</p>
                  <span className="text-[10px] uppercase font-bold text-text-secondary capitalize">
                    {e.status}
                  </span>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    disabled={e.status !== 'active' || !e.process_stages?.length}
                    onClick={() => setMoveOpenId(moveOpen ? null : e.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${BTN}`}
                    style={{
                      background: `${stageColor}1A`,
                      borderColor: `${stageColor}44`,
                      color: stageColor,
                    }}
                  >
                    {e.current_stage_name ?? '—'}
                    {e.status === 'active' && <ChevronDown className="h-2.5 w-2.5 opacity-70" />}
                  </button>
                  {moveOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMoveOpenId(null)} />
                      <div className="absolute left-0 top-full z-40 mt-1 min-w-[200px] rounded-lg border border-border-color bg-card-bg shadow-lg py-1">
                        {(e.process_stages ?? []).map((s) => {
                          const active = s.id === e.current_stage_id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleStageMove(e, s.id)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${BTN}`}
                            >
                              {s.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />}
                              <span className={`flex-1 ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}>{s.name}</span>
                              {active && <Check className="h-3 w-3 text-accent" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-text-secondary">
                  {e.expected_value != null && (
                    <span className="font-semibold text-text-primary">{formatCurrency(e.expected_value)}</span>
                  )}
                  {e.expected_close_date && (
                    <span>· close {formatDayMonth(e.expected_close_date)}</span>
                  )}
                  {e.priority && (
                    <span className="capitalize">· {e.priority}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {addOpen && (
        <AddToPipelineModal
          entityType="contact"
          entityId={contact.id}
          entityName={contact.name}
          entityPhone={contact.phone}
          onClose={() => setAddOpen(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ['contact-v2', contact.id, 'processes'] })}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ACTIVITY VIEW (full timeline)
   ═══════════════════════════════════════════════════════════════════════ */

export function ActivityView({ contact, setView }: ViewProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['contact-v2', contact.id, 'activities'],
    queryFn: () => contactsV2Service.getActivities(contact.id, 100),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Activity" count={events.length} onBack={() => setView('summary')} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <ActivityIcon className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-3 bottom-3 w-px bg-border-color" />
            <ul className="space-y-3">
              {events.map((a: ContactActivity) => (
                <li key={a.id} className="relative flex gap-3">
                  <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-color bg-card-bg text-[10px]">
                    {ACTIVITY_EMOJI[a.activity_type] ?? '🔹'}
                  </span>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-xs text-text-primary leading-snug">
                      {a.description ?? a.activity_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {a.user_name && <span>{a.user_name} · </span>}
                      {formatRelativeTime(a.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CONVERSATIONS VIEW (cross-channel)
   ═══════════════════════════════════════════════════════════════════════ */

export function ConversationsView({
  contact, setView, conversations, conversationId, onOpenConversation,
}: ViewProps) {
  const items = useMemo(
    () => conversations.filter((c) => c.contactId === contact.id),
    [conversations, contact.id],
  );

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Conversations" count={items.length} onBack={() => setView('summary')} />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <MessageSquare className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">Only this conversation so far</p>
          </div>
        ) : (
          items.map((c) => {
            const current = c.id === conversationId;
            const ch = c.channelType?.toLowerCase() ?? '';
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenConversation?.(c.id)}
                disabled={current}
                className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${BTN} ${
                  current
                    ? 'border-accent bg-accent/10 cursor-default'
                    : 'border-border-color bg-card-bg hover:border-accent/40 hover:bg-bg-secondary'
                }`}
              >
                <span aria-hidden className="text-base leading-none mt-0.5">{CHANNEL_EMOJI[ch] ?? '📡'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-text-primary capitalize truncate flex-1">
                      {c.channelName || c.channelType || 'Channel'}
                    </span>
                    <span className="text-[10px] text-text-secondary shrink-0">{formatRelativeTime(c.updatedAt)}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">{c.lastMessagePreview || '—'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {current && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Current</span>
                    )}
                    {c.unreadCount != null && c.unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {c.unreadCount} unread
                      </span>
                    )}
                    {c.agentName && c.agentName !== '—' && (
                      <span className="text-[10px] text-text-secondary truncate">
                        <Bot className="inline h-2.5 w-2.5 mr-0.5" />{c.agentName}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSIGHTS VIEW (conversation analytics + LLM cost)
   ═══════════════════════════════════════════════════════════════════════ */

export function InsightsView({
  setView, conversationAnalytics, sessions = [],
}: ViewProps) {
  const totalCost = sessions.reduce((s, x) => s + (x.llmCostUsd || 0), 0);
  const totalRuns = sessions.reduce((s, x) => s + (x.llmRunsCount || 0), 0);
  const totalTok = sessions.reduce((s, x) => s + (x.llmInputTokens || 0) + (x.llmOutputTokens || 0), 0);
  const cachedTok = sessions.reduce((s, x) => s + (x.llmCachedInputTokens || 0), 0);

  const empty = !conversationAnalytics && sessions.length === 0;

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Insights" onBack={() => setView('summary')} />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <BarChart3 className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">No insights for this conversation yet</p>
          </div>
        ) : (
          <>
            {conversationAnalytics && (
              <>
                <p className="text-[10px] uppercase tracking-wide font-bold text-text-secondary px-1">This conversation</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                    <p className="text-[10px] uppercase text-text-secondary font-semibold tracking-wide">Messages</p>
                    <p className="text-base font-bold text-text-primary mt-0.5">{conversationAnalytics.message_count}</p>
                  </div>
                  <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                    <p className="text-[10px] uppercase text-text-secondary font-semibold tracking-wide">Avg response</p>
                    <p className="text-base font-bold text-text-primary mt-0.5">
                      {conversationAnalytics.avg_response_time != null ? `${conversationAnalytics.avg_response_time.toFixed(1)}s` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                    <p className="text-[10px] uppercase text-text-secondary font-semibold tracking-wide">First reply</p>
                    <p className="text-base font-bold text-text-primary mt-0.5">
                      {conversationAnalytics.first_response_time != null ? `${conversationAnalytics.first_response_time.toFixed(1)}s` : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                    <p className="text-[10px] uppercase text-text-secondary font-semibold tracking-wide">Status</p>
                    <p className="text-base font-bold text-text-primary mt-0.5 capitalize">{conversationAnalytics.status}</p>
                  </div>
                </div>
              </>
            )}

            {totalRuns > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide font-bold text-text-secondary px-1 pt-1">AI usage</p>
                <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
                  <div className="flex items-baseline gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-lg font-bold text-text-primary">
                      {totalCost < 0.01 ? `$${totalCost.toFixed(6)}` : `$${totalCost.toFixed(4)}`}
                    </span>
                    <span className="text-[10px] text-text-secondary">spent</span>
                  </div>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {totalRuns} runs · {totalTok.toLocaleString()} tokens
                    {cachedTok > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400"> · {cachedTok.toLocaleString()} cached</span>
                    )}
                  </p>
                </div>
              </>
            )}

            {sessions.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide font-bold text-text-secondary px-1 pt-1">
                  Sessions ({sessions.length})
                </p>
                <ul className="space-y-1.5">
                  {sessions.slice(0, 10).map((s) => (
                    <li key={s.id} className="rounded-lg border border-border-color bg-card-bg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-text-primary">#{s.id}</span>
                        <span className="text-[10px] text-text-secondary capitalize">{s.status}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        {formatDateTime(s.startedAt)} ·{' '}
                        {formatDuration(s.durationSeconds)} · {s.messagesCount} msgs
                      </p>
                      {s.summary && <p className="mt-0.5 text-[11px] text-text-secondary line-clamp-2">{s.summary}</p>}
                    </li>
                  ))}
                  {sessions.length > 10 && (
                    <li className="text-center text-[11px] text-text-secondary">+{sessions.length - 10} more</li>
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DATA VIEW — datasheet records linked to this contact
   ═══════════════════════════════════════════════════════════════════════ */

interface LinkedSheet {
  source: DatasheetSource;
  records: Array<Record<string, unknown>>;
  total: number;
}

async function fetchLinkedDatasheets(contactId: number): Promise<LinkedSheet[]> {
  let sources: DatasheetSource[] = [];
  try {
    sources = await getTemplateDatasheetSources();
  } catch {
    return [];
  }
  const linked = sources.filter((s) => s.has_lead_relation && s.lead_relation_field);
  if (!linked.length) return [];

  const results = await Promise.all(
    linked.map(async (s) => {
      try {
        const res = await queryRecords(s.model_id, {
          filters: [{ field: s.lead_relation_field!, op: 'eq', value: contactId }],
          per_page: 20,
        });
        return {
          source: s,
          records: res.items ?? [],
          total: res.total ?? (res.items?.length ?? 0),
        } as LinkedSheet;
      } catch {
        return { source: s, records: [], total: 0 } as LinkedSheet;
      }
    }),
  );
  // Keep only sheets that have at least one matching record so the view stays focused.
  return results.filter((r) => r.records.length > 0);
}

async function fetchLinkedRecordCounts(contactId: number): Promise<{ total: number; sheets: number }> {
  const linked = await fetchLinkedDatasheets(contactId);
  return {
    total: linked.reduce((s, l) => s + l.total, 0),
    sheets: linked.length,
  };
}

/** Render a single field value, gracefully handling primitives/dates/objects. */
function formatFieldValue(value: unknown, ftype: string): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(v, ftype)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return String(v.label ?? v.name ?? v.id ?? JSON.stringify(v));
  }
  if (ftype === 'currency' && typeof value === 'number') return formatCurrency(value);
  if (ftype === 'date' && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDate(d);
  }
  if (ftype === 'datetime' && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDateTime(d);
  }
  return String(value);
}

function DatasheetRecordCard({ source, record }: { source: DatasheetSource; record: Record<string, unknown> }) {
  // First text-ish field becomes the "title", up to 4 more become detail rows.
  const titleField = source.fields.find((f) =>
    ['text', 'short_text', 'long_text'].includes(f.field_type),
  ) ?? source.fields[0];
  const detailFields = source.fields
    .filter((f) => f.name !== titleField?.name)
    .slice(0, 4);
  const titleValue = titleField ? formatFieldValue(record[titleField.name], titleField.field_type) : '—';
  const recordId = typeof record.id === 'number' ? record.id : null;

  return (
    <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-text-primary">{titleValue || '—'}</p>
          {recordId != null && (
            <p className="text-[10px] text-text-secondary mt-0.5">#{recordId}</p>
          )}
        </div>
        {recordId != null && (
          <Link
            href={`/data-sheet/${source.model_id}?record=${recordId}`}
            title="Open record in datasheet"
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${BTN}`}
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      {detailFields.length > 0 && (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1">
          {detailFields.map((f) => {
            const v = formatFieldValue(record[f.name], f.field_type);
            return (
              <div key={f.name} className="contents">
                <dt className="text-[10px] uppercase tracking-wide font-semibold text-text-secondary truncate">
                  {f.display_name}
                </dt>
                <dd className="text-[11px] text-text-primary truncate" title={v}>{v}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

function DatasheetGroup({ sheet }: { sheet: LinkedSheet }) {
  const [open, setOpen] = useState(true);
  const previewLimit = 5;
  const showing = open ? sheet.records.slice(0, previewLimit) : [];
  const remaining = sheet.records.length - showing.length;
  return (
    <section className="rounded-lg border border-border-color bg-bg-secondary/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-secondary transition-colors ${BTN}`}
      >
        <Table2 className="h-3.5 w-3.5 text-text-secondary shrink-0" />
        <span className="text-xs font-semibold text-text-primary truncate flex-1">
          {sheet.source.display_name}
        </span>
        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent/10 px-1 text-[10px] font-bold text-accent">
          {sheet.total}
        </span>
        <ChevronDown className={`h-3 w-3 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          {showing.map((r, i) => (
            <DatasheetRecordCard
              key={(r.id as number) ?? i}
              source={sheet.source}
              record={r}
            />
          ))}
          {remaining > 0 && (
            <Link
              href={`/data-sheet/${sheet.source.model_id}`}
              className={`block text-center text-[11px] font-semibold text-accent hover:underline py-1 ${BTN} rounded`}
            >
              View all {sheet.total} in {sheet.source.display_name} →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export function DataView({ contact, setView }: ViewProps) {
  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['contact-v2', contact.id, 'linked-datasheets'],
    queryFn: () => fetchLinkedDatasheets(contact.id),
    staleTime: 60_000,
  });

  const totalRecords = sheets.reduce((s, x) => s + x.total, 0);

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Linked data" count={totalRecords} onBack={() => setView('summary')} />
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <Database className="h-10 w-10 text-text-secondary/30" />
            <p className="text-sm text-text-secondary">No datasheet records linked to this contact yet.</p>
            <p className="text-[11px] text-text-secondary/70">
              Records in any datasheet whose contact-relation field points to this contact will appear here.
            </p>
            <Link
              href="/data-sheet"
              className={`mt-1 inline-flex items-center gap-1.5 rounded-md border border-border-color bg-card-bg px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-accent hover:border-accent/40 transition-colors ${BTN}`}
            >
              <Database className="h-3 w-3" />
              Browse datasheets
            </Link>
          </div>
        ) : (
          sheets.map((sheet) => (
            <DatasheetGroup key={sheet.source.model_id} sheet={sheet} />
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT ROUTING VIEW (full-body picker for agent + mode)
   ═══════════════════════════════════════════════════════════════════════ */

export function EditRoutingView({ contact, setContact, setView, agents }: ViewProps) {
  const [mode, setMode] = useState<RoutingMode>(contact.routing_mode);
  const [agentId, setAgentId] = useState<number | null>(contact.ai_agent_id);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const next = await contactsV2Service.updateRouting(contact.id, mode, mode === 'ai' ? agentId : null);
      setContact(next);
      setView('summary');
    } finally {
      setSaving(false);
    }
  };

  const active = agents.filter((a) => a.status === 'active');

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="Edit routing" onBack={() => setView('summary')} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-2">Routing mode</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(ROUTING_META) as RoutingMode[]).map((m) => {
              const meta = ROUTING_META[m];
              const Icon = ROUTING_ICONS[meta.iconName];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-semibold transition-colors ${BTN} ${
                    isActive ? meta.pill : 'border-border-color bg-card-bg text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
        {mode === 'ai' && (
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-2">AI agent</label>
            {active.length === 0 ? (
              <p className="text-xs text-text-secondary px-1">No active AI agents. Configure one in Agents.</p>
            ) : (
              <div className="rounded-lg border border-border-color bg-card-bg divide-y divide-border-color">
                {active.map((a) => {
                  const isActive = Number(agentId) === Number(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAgentId(Number(a.id))}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors ${BTN} ${
                        isActive ? 'bg-accent/10 text-accent font-semibold' : 'text-text-primary hover:bg-bg-secondary'
                      }`}
                    >
                      <Bot className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-text-secondary'}`} />
                      <span className="truncate flex-1">{a.name}</span>
                      <span className="text-[10px] text-text-secondary capitalize">{a.role}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border-color bg-card-bg px-4 py-3 flex gap-2">
        <button
          type="button"
          onClick={() => setView('summary')}
          className={`flex-1 rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors ${BTN}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || (mode === 'ai' && agentId == null && active.length > 0)}
          className={`flex-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity ${BTN}`}
        >
          {saving ? 'Saving…' : 'Save routing'}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROUTER — exported map { view → component }
   ═══════════════════════════════════════════════════════════════════════ */

export const RailViews: Record<ViewProps['view'], (props: ViewProps) => React.ReactElement> = {
  summary:            SummaryView,
  notes:              NotesView,
  'compose-note':     ComposeNoteView,
  followups:          FollowupsView,
  'compose-followup': ComposeFollowupView,
  pipeline:           PipelineView,
  activity:           ActivityView,
  conversations:      ConversationsView,
  insights:           InsightsView,
  data:               DataView,
  'edit-routing':     EditRoutingView,
};
