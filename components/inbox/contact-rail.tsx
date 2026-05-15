'use client';

/**
 * ContactRail — persistent right-side context panel for /inbox.
 *
 * Architecture (post-redesign):
 *  - This file is a thin SHELL. It loads the contact, renders the always-on
 *    header strips (identity, contact row, view switcher), and routes to
 *    ONE view body at a time.
 *  - All view bodies live in contact-rail-views.tsx and follow ViewProps.
 *  - Shared types/constants/helpers live in contact-rail-common.ts.
 *
 *  Why: the previous shell stacked 11 always-mounted sections plus persistent
 *  forms, which made the rail feel crammed. Separating "scanning" (summary
 *  view) from "doing" (focused list / compose views) gives each task the
 *  full width of the panel.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PanelRightClose, PanelRightOpen, ExternalLink, Phone, Mail, Copy, Check,
  X, StickyNote, Bell, Activity as ActivityIcon, GitBranch, MessageSquare,
  BarChart3, Flame, Loader2, MoreVertical, Trash2, ShieldOff, LayoutGrid,
  Database,
} from 'lucide-react';
import {
  contactsV2Service,
  type Contact as ContactV2,
} from '@/services/contacts-v2';
import type { AgentSummary } from '@/services/conversations';
import type { ConversationAnalyticsResponse } from '@/services/analytics';
import type { ConversationSession, InboxConversation } from '@/services/customers';
import {
  type RailView,
  BTN, PRIORITY_META, CHANNEL_EMOJI,
  getInitials, fetchFollowUps,
} from './contact-rail-common';
import { RailViews } from './contact-rail-views';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface Props {
  contactId: number | null;
  fallback?: { name?: string | null; phone?: string | null; channelType?: string | null; leadId?: string | null };
  agents: AgentSummary[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  conversationId?: string | null;
  conversations?: InboxConversation[];
  conversationAnalytics?: ConversationAnalyticsResponse | null;
  sessions?: ConversationSession[];
  onOpenConversation?: (conversationId: string) => void;
  onClose?: () => void;
}

/* ─── View-switcher tab definitions ─────────────────────────────────── */

type TabKey = 'summary' | 'notes' | 'followups' | 'pipeline' | 'activity' | 'conversations' | 'insights' | 'data';

const TABS: { key: TabKey; label: string; Icon: typeof LayoutGrid }[] = [
  { key: 'summary',       label: 'Summary',  Icon: LayoutGrid },
  { key: 'notes',         label: 'Notes',    Icon: StickyNote },
  { key: 'followups',     label: 'Follow-ups', Icon: Bell },
  { key: 'pipeline',      label: 'Pipeline', Icon: GitBranch },
  { key: 'data',          label: 'Data',     Icon: Database },
  { key: 'activity',      label: 'Activity', Icon: ActivityIcon },
  { key: 'conversations', label: 'Convos',   Icon: MessageSquare },
  { key: 'insights',      label: 'Insights', Icon: BarChart3 },
];

/** Sub-views report up to the closest tab (so the strip shows where you are). */
function viewToTab(view: RailView): TabKey {
  if (view === 'compose-note') return 'notes';
  if (view === 'compose-followup') return 'followups';
  if (view === 'edit-routing') return 'summary';
  return view as TabKey;
}

/* ═══════════════════════════════════════════════════════════════════════
   COLLAPSED ICON-RAIL
   ═══════════════════════════════════════════════════════════════════════ */

function CollapsedRail({
  onExpand, onExpandToView, contactName,
}: {
  onExpand: () => void;
  onExpandToView: (v: RailView) => void;
  contactName?: string | null;
}) {
  const initials = getInitials(contactName, '?');
  return (
    <aside className="hidden lg:flex shrink-0 w-11 flex-col items-center gap-1.5 border-l border-border-color bg-bg-secondary py-2.5">
      <button
        type="button"
        onClick={onExpand}
        title="Expand contact panel"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg hover:text-text-primary transition-colors ${BTN}`}
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
      <div className="my-1 h-px w-6 bg-border-color" />
      <button
        type="button"
        onClick={onExpand}
        title={contactName ?? 'Open contact'}
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-card-bg text-xs font-semibold text-text-primary border border-border-color hover:ring-2 hover:ring-accent transition-all ${BTN}`}
      >
        {initials}
      </button>
      {TABS.filter((t) => t.key !== 'summary').map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onExpandToView(key as RailView)}
          title={label}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-card-bg hover:text-text-primary transition-colors ${BTN}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HEADER OVERFLOW MENU
   ═══════════════════════════════════════════════════════════════════════ */

function HeaderOverflowMenu({
  contactId, onDeleted,
}: {
  contactId: number;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-overflow-menu]')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const block = async () => {
    setBusy(true);
    try {
      await contactsV2Service.updateRouting(contactId, 'blocked', null);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this contact? Their conversations will remain, but contact data will be removed.')) return;
    setBusy(true);
    try {
      await contactsV2Service.delete(contactId);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-overflow-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="More actions"
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${BTN}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-border-color bg-card-bg shadow-lg py-1">
          <Link
            href={`/contacts/${contactId}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-3.5 w-3.5 text-text-secondary" /> Open full profile
          </Link>
          <button
            type="button"
            onClick={block}
            disabled={busy}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary text-left disabled:opacity-50 ${BTN}`}
          >
            <ShieldOff className="h-3.5 w-3.5 text-text-secondary" /> Block contact
          </button>
          <div className="my-1 border-t border-border-color" />
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-left disabled:opacity-50 ${BTN}`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete contact
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   IDENTITY HEADER (always-visible top strip)
   ═══════════════════════════════════════════════════════════════════════ */

function IdentityHeader({
  contact, fallback, onToggleCollapsed, onDeleted,
}: {
  contact: ContactV2 | null;
  fallback?: Props['fallback'];
  onToggleCollapsed: () => void;
  onDeleted: () => void;
}) {
  const name = contact?.name ?? fallback?.name ?? 'Unknown contact';
  const phone = contact?.phone ?? fallback?.phone ?? null;
  const rawPriority = contact?.priority ?? 'medium';
  const priority = (PRIORITY_META[rawPriority] ? rawPriority : 'medium') as keyof typeof PRIORITY_META;
  const priorityMeta = PRIORITY_META[priority];
  const source = contact?.source ?? fallback?.channelType ?? null;
  const initials = getInitials(name, phone ?? '?');

  return (
    <div className="flex items-start gap-3 px-4 pt-3 pb-3 bg-card-bg border-b border-border-color">
      <div
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent ring-2 ${priorityMeta.ring}`}
      >
        {initials}
        {priority === 'hot' && (
          <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-red-500 text-white" style={{ height: 18, width: 18 }}>
            <Flame className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary leading-tight">{name}</p>
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${priorityMeta.pill}`}>
            {priorityMeta.label}
          </span>
          {source && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-secondary border border-border-color px-1.5 py-0.5 text-[10px] text-text-secondary">
              <span aria-hidden>{CHANNEL_EMOJI[source.toLowerCase()] ?? '📡'}</span>
              <span className="capitalize">{source}</span>
            </span>
          )}
          {contact?.overdue_followup_count != null && contact.overdue_followup_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 border border-red-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-300">
              <Bell className="h-2.5 w-2.5" />
              {contact.overdue_followup_count} overdue
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {contact && <HeaderOverflowMenu contactId={contact.id} onDeleted={onDeleted} />}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Collapse contact panel"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${BTN}`}
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK CONTACT ROW — phone / email (always visible if present)
   ═══════════════════════════════════════════════════════════════════════ */

function CopyableRow({
  Icon, value, href, label,
}: {
  Icon: typeof Phone;
  value: string;
  href: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${label}`}
      className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-secondary transition-colors"
    >
      <Icon className="h-3.5 w-3.5 text-text-secondary shrink-0" />
      <span className="text-xs text-text-primary truncate flex-1">{value}</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy"
        className={`opacity-0 group-hover:opacity-100 inline-flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-card-bg transition-all ${BTN}`}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </a>
  );
}

function ContactInfoStrip({ contact }: { contact: ContactV2 }) {
  if (!contact.phone && !contact.email) return null;
  return (
    <div className="shrink-0 border-b border-border-color bg-card-bg/60 px-2 py-1">
      {contact.phone && (
        <CopyableRow
          Icon={Phone}
          value={contact.phone}
          href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
          label="WhatsApp"
        />
      )}
      {contact.email && (
        <CopyableRow Icon={Mail} value={contact.email} href={`mailto:${contact.email}`} label="email" />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   VIEW SWITCHER — 7 icon tabs across the top of the body
   ═══════════════════════════════════════════════════════════════════════ */

function ViewSwitcher({
  view, setView, counts,
}: {
  view: RailView;
  setView: (v: RailView) => void;
  counts: { notes: number; followups: number; pipelines: number; overdueFu: number };
}) {
  const activeTab = viewToTab(view);
  return (
    <div role="tablist" aria-label="Contact panel views" className="shrink-0 flex items-stretch gap-0.5 bg-bg-secondary border-b border-border-color px-1.5 py-1 overflow-x-auto">
      {TABS.map(({ key, label, Icon }) => {
        const active = activeTab === key;
        let badge: number | null = null;
        let danger = false;
        if (key === 'notes' && counts.notes > 0) badge = counts.notes;
        else if (key === 'followups' && counts.followups > 0) {
          badge = counts.followups;
          danger = counts.overdueFu > 0;
        }
        else if (key === 'pipeline' && counts.pipelines > 0) badge = counts.pipelines;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            onClick={() => setView(key as RailView)}
            title={label}
            aria-selected={active}
            className={`relative shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-1.5 min-w-[40px] transition-colors ${BTN} ${
              active
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-card-bg hover:text-text-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[9px] font-semibold leading-none">{label}</span>
            {badge != null && (
              <span
                className={`absolute -top-0.5 -right-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${
                  danger
                    ? 'bg-red-500 text-white'
                    : active
                      ? 'bg-accent text-white'
                      : 'bg-bg-secondary border border-border-color text-text-secondary'
                }`}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EMPTY STATE (no contact selected / fallback lead)
   ═══════════════════════════════════════════════════════════════════════ */

function EmptyState({ fallback }: { fallback?: Props['fallback'] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center gap-2">
      <span className="text-3xl text-text-secondary/40" aria-hidden>👤</span>
      <p className="text-sm font-medium text-text-primary">
        {fallback?.name ?? 'No contact selected'}
      </p>
      {fallback?.name ? (
        <>
          <p className="text-xs text-text-secondary">
            This conversation is on a legacy lead record. Open the full profile to enrich into a Contact.
          </p>
          {fallback.leadId && (
            <Link
              href={`/customers/${fallback.leadId}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/15 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open lead profile
            </Link>
          )}
        </>
      ) : (
        <p className="text-xs text-text-secondary">
          Select a conversation to see contact context here.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COUNTS HOOK — feeds badges + summary tiles from one set of queries
   ═══════════════════════════════════════════════════════════════════════ */

function useRailCounts(contactId: number | null) {
  const { data: notes = [] } = useQuery({
    queryKey: ['contact-v2', contactId, 'notes'],
    queryFn: () => contactsV2Service.getNotes(contactId!),
    staleTime: 30_000,
    enabled: contactId != null,
  });
  const { data: processes = [] } = useQuery({
    queryKey: ['contact-v2', contactId, 'processes'],
    queryFn: () => contactsV2Service.getProcesses(contactId!),
    staleTime: 30_000,
    enabled: contactId != null,
  });
  const { data: followups = [] } = useQuery({
    queryKey: ['contact-v2', contactId, 'followups'],
    queryFn: () => fetchFollowUps(contactId!),
    staleTime: 30_000,
    enabled: contactId != null,
  });

  return useMemo(() => {
    const pendingFu = followups.filter((f) => f.status === 'scheduled' || f.status === 'pending_manual');
    const overdueFu = pendingFu.filter((f) => new Date(f.scheduled_at).getTime() < Date.now()).length;
    const activeProcs = processes.filter((p) => p.status === 'active').length;
    return {
      notes: notes.length,
      followups: pendingFu.length,
      pipelines: activeProcs,
      overdueFu,
    };
  }, [notes, followups, processes]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export function ContactRail({
  contactId, fallback, agents, collapsed, onToggleCollapsed, onClose,
  conversationId, conversations = [], conversationAnalytics = null, sessions = [],
  onOpenConversation,
}: Props) {
  const qc = useQueryClient();
  const [view, setView] = useState<RailView>('summary');

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact-v2', contactId],
    queryFn: () => contactsV2Service.get(contactId!),
    enabled: contactId != null,
    staleTime: 30_000,
  });

  /* Reset to summary whenever the contact changes. */
  useEffect(() => {
    setView('summary');
  }, [contactId]);

  const counts = useRailCounts(contactId);

  const setContact = (next: ContactV2) => {
    if (contactId == null) return;
    qc.setQueryData(['contact-v2', contactId], next);
  };

  const onDeletedFromMenu = () => {
    qc.removeQueries({ queryKey: ['contact-v2', contactId] });
  };

  /* Keyboard shortcuts — ignore when typing in an input/textarea */
  useEffect(() => {
    if (collapsed || !contact) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || (t as HTMLElement | null)?.isContentEditable;
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (view !== 'summary') {
          e.preventDefault();
          setView('summary');
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setView('compose-note');
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setView('compose-followup');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [collapsed, contact, view]);

  if (collapsed) {
    return (
      <CollapsedRail
        onExpand={onToggleCollapsed}
        onExpandToView={(v) => {
          onToggleCollapsed();
          setView(v);
        }}
        contactName={contact?.name ?? fallback?.name}
      />
    );
  }

  const ViewBody = contact ? RailViews[view] : null;

  return (
    <aside className="hidden lg:flex lg:w-[380px] xl:w-[440px] shrink-0 flex-col border-l border-border-color bg-bg-secondary overflow-hidden relative">
      <IdentityHeader
        contact={contact ?? null}
        fallback={fallback}
        onToggleCollapsed={onToggleCollapsed}
        onDeleted={onDeletedFromMenu}
      />

      {contactId != null && isLoading && !contact && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
        </div>
      )}

      {contactId == null && <EmptyState fallback={fallback} />}

      {contact && ViewBody && (
        <>
          <ContactInfoStrip contact={contact} />
          <ViewSwitcher view={view} setView={setView} counts={counts} />
          <ViewBody
            contact={contact}
            setContact={setContact}
            view={view}
            setView={setView}
            agents={agents}
            conversations={conversations}
            conversationId={conversationId}
            conversationAnalytics={conversationAnalytics}
            sessions={sessions}
            onOpenConversation={onOpenConversation}
          />
        </>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-3 right-3 lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-md bg-bg-secondary text-text-secondary hover:text-text-primary ${BTN}`}
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Mobile/tablet overlay variant
   ═══════════════════════════════════════════════════════════════════════ */

export function ContactRailOverlay(props: Omit<Props, 'collapsed' | 'onToggleCollapsed'>) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={props.onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-[400px] max-w-[92vw] bg-bg-secondary shadow-2xl flex flex-col">
        <ContactRail {...props} collapsed={false} onToggleCollapsed={() => props.onClose?.()} />
      </div>
    </div>
  );
}
