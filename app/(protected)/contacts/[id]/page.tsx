'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import {
  ArrowLeft, User, Phone, Mail, Building2, Tag as TagIcon, Bot, MessageSquare,
  Clock, Plus, Trash2, Loader2, Activity, FileText, Layers, Wifi,
  AlertCircle, Megaphone, Calendar, DollarSign, FolderKanban,
  LayoutList, ChevronRight, Pencil, Save, X, Hash, Shield,
} from 'lucide-react';
import ModuleGuard from '@/components/module-guard';
import { useContactV2Store, type ContactV2State } from '@/lib/contact-v2-store';
import { useAuthStore } from '@/lib/auth-store';
import { useAgentList, useEmployeeList } from '@/lib/hooks/use-reference-data';
import {
  contactsV2Service,
  type Contact,
  type ContactChannel,
  type ContactGroup,
  type RoutingMode,
  type Priority,
  type NoteCategory,
} from '@/services/contacts-v2';
import {
  listFieldDefs, setContactCustomFields, type ContactFieldDef,
} from '@/services/contact-field-defs';

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'details' | 'activity' | 'notes' | 'pipeline' | 'channels' | 'groups';

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', Icon: User },
  { id: 'details',  label: 'Details',  Icon: LayoutList },
  { id: 'activity', label: 'Activity', Icon: Activity },
  { id: 'notes',    label: 'Notes',    Icon: FileText },
  { id: 'pipeline', label: 'Pipeline', Icon: Layers },
  { id: 'channels', label: 'Channels', Icon: Wifi },
  { id: 'groups',   label: 'Groups',   Icon: FolderKanban },
];

const PRIORITY_OPTIONS: Priority[] = ['hot', 'high', 'medium', 'low'];
const ROUTING_OPTIONS: RoutingMode[] = ['ai', 'manual', 'blocked'];

const PRIORITY_STYLE: Record<Priority, string> = {
  hot:    'bg-red-500/10 text-red-500 border-red-500/30',
  high:   'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low:    'bg-blue-500/10 text-blue-500 border-blue-500/30',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  hot: '🔥 Hot', high: '↑ High', medium: '— Medium', low: '↓ Low',
};

const ROUTING_STYLE: Record<RoutingMode, string> = {
  ai:      'bg-green-500/10 text-green-500 border-green-500/30',
  manual:  'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  blocked: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const ROUTING_LABEL: Record<RoutingMode, string> = {
  ai: '🤖 AI', manual: '👤 Manual', blocked: '🚫 Blocked',
};

const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'General',
  preference: 'Preference',
  complaint: 'Complaint',
  'follow-up': 'Follow-up',
};

const NOTE_CATEGORY_COLORS: Record<NoteCategory, string> = {
  general: 'bg-gray-500/10 text-gray-500',
  preference: 'bg-indigo-500/10 text-indigo-500',
  complaint: 'bg-red-500/10 text-red-500',
  'follow-up': 'bg-amber-500/10 text-amber-600',
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  return (
    <ModuleGuard moduleKey="contacts">
      <ContactDetailInner />
    </ModuleGuard>
  );
}

function ContactDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const contactId = Number(params?.id);

  const {
    selectedContact, loadingDetail, activities, notes, processes,
    loadingActivities, loadingNotes, loadingProcesses,
    select, clearSelected, update, updateRouting, assign,
    addNote, deleteNote, removeTag, moveProcessStage, remove,
    tags: allTags, loadTags, addTag,
    groups: allGroups, loadGroups, addToGroup, removeFromGroup,
  } = useContactV2Store(useShallow(s => ({
    selectedContact: s.selectedContact,
    loadingDetail: s.loadingDetail,
    activities: s.activities,
    notes: s.notes,
    processes: s.processes,
    loadingActivities: s.loadingActivities,
    loadingNotes: s.loadingNotes,
    loadingProcesses: s.loadingProcesses,
    select: s.select,
    clearSelected: s.clearSelected,
    update: s.update,
    updateRouting: s.updateRouting,
    assign: s.assign,
    addNote: s.addNote,
    deleteNote: s.deleteNote,
    removeTag: s.removeTag,
    addTag: s.addTag,
    moveProcessStage: s.moveProcessStage,
    remove: s.remove,
    tags: s.tags,
    loadTags: s.loadTags,
    groups: s.groups,
    loadGroups: s.loadGroups,
    addToGroup: s.addToGroup,
    removeFromGroup: s.removeFromGroup,
  })));

  const hasPermission = useAuthStore(s => s.hasPermission);
  const canManage = hasPermission('manage_leads');
  const business = useAuthStore(s => (s.user as { businesses?: Array<{ agents_enabled?: boolean }> } | null)?.businesses?.[0]);
  const agentsEnabled = business?.agents_enabled !== false;

  const { data: employees = [] } = useEmployeeList();
  const { data: agents = [] } = useAgentList({ enabled: agentsEnabled });

  const [tab, setTab] = useState<TabId>('overview');
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Load contact ──────────────────────────────────────────────
  useEffect(() => {
    if (!Number.isFinite(contactId)) return;
    void select(contactId);
    return () => clearSelected();
  }, [contactId, select, clearSelected]);

  // ── Load tags ─────────────────────────────────────────────────
  useEffect(() => {
    if (allTags.length === 0) void loadTags();
  }, [allTags.length, loadTags]);

  // ── Load groups when the Groups tab is opened (or once for badges) ──
  useEffect(() => {
    if (allGroups.length === 0) void loadGroups();
  }, [allGroups.length, loadGroups]);

  // ── Load channels on demand ───────────────────────────────────
  useEffect(() => {
    if (tab !== 'channels' || !Number.isFinite(contactId)) return;
    let cancelled = false;
    setChannelsLoading(true);
    contactsV2Service.getChannels(contactId)
      .then(rows => { if (!cancelled) setChannels(rows); })
      .catch(() => { if (!cancelled) setChannels([]); })
      .finally(() => { if (!cancelled) setChannelsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, contactId]);

  if (!Number.isFinite(contactId)) {
    return <div className="p-8 text-text-secondary">Invalid contact id.</div>;
  }

  if (loadingDetail && !selectedContact) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading contact…
      </div>
    );
  }

  if (!selectedContact) {
    return (
      <div className="p-8">
        <button onClick={() => router.back()} className="mb-4 text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center">
          <AlertCircle className="h-8 w-8 text-text-secondary mx-auto mb-2" />
          <p className="text-text-primary font-medium">Contact not found</p>
          <p className="text-sm text-text-secondary mt-1">This contact may have been deleted.</p>
        </div>
      </div>
    );
  }

  const c = selectedContact;

  const handlePriority = async (p: Priority) => {
    setActionError(null);
    try { await update(c.id, { priority: p }); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Failed to update priority'); }
  };

  const handleRouting = async (mode: RoutingMode, agentId?: number | null) => {
    setActionError(null);
    try { await updateRouting(c.id, mode, agentId); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Failed to update routing'); }
  };

  const handleAssign = async (userId: number | null) => {
    setActionError(null);
    try { await assign(c.id, userId); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Failed to assign'); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete contact "${c.name || c.phone || c.id}"? This cannot be undone.`)) return;
    try {
      await remove(c.id);
      router.push('/contacts');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border-color bg-card-bg/95 backdrop-blur supports-[backdrop-filter]:bg-card-bg/75">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-primary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            {c.latest_conversation_id && (
              <Link
                href={`/inbox?conversation=${c.latest_conversation_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-primary"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Open in Inbox
              </Link>
            )}
            {canManage && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {actionError}
            <button className="ml-auto" onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ── Header card ───────────────────────────────────────── */}
        <ContactHeader
          contact={c}
          canManage={canManage}
          onPriority={handlePriority}
          onRouting={handleRouting}
          onAssign={handleAssign}
          employees={employees}
          agents={agents}
          agentsEnabled={agentsEnabled}
        />

        {/* ── Tabs ──────────────────────────────────────────────── */}
        <div className="mt-6 border-b border-border-color">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <t.Icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content grid ──────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {tab === 'overview' && <OverviewTab contact={c} />}
            {tab === 'details' && <DetailsTab contact={c} />}
            {tab === 'activity' && <ActivityTab activities={activities} loading={loadingActivities} />}
            {tab === 'notes' && (
              <NotesTab
                contact={c}
                notes={notes}
                loading={loadingNotes}
                onAdd={(content, category) => addNote(c.id, content, category)}
                onDelete={(noteId) => deleteNote(c.id, noteId)}
              />
            )}
            {tab === 'pipeline' && (
              <PipelineTab
                contact={c}
                processes={processes}
                loading={loadingProcesses}
                onMoveStage={(entryId, stageId) => moveProcessStage(c.id, entryId, stageId)}
              />
            )}
            {tab === 'channels' && (
              <ChannelsTab
                channels={channels}
                loading={channelsLoading}
                contactId={c.id}
                agents={agents}
                canManage={canManage}
                onChannelUpdated={(channelId, patch) => {
                  setChannels((prev) =>
                    prev.map((row) =>
                      row.channel_id === channelId
                        ? {
                            ...row,
                            ...('routing_mode' in patch ? { routing_mode: patch.routing_mode ?? null } : {}),
                            ...('agent_id' in patch
                              ? {
                                  agent_id: patch.agent_id ?? null,
                                  agent_name: patch.agent_id
                                    ? agents.find((a) => Number(a.id) === patch.agent_id)?.name ?? row.agent_name
                                    : null,
                                }
                              : {}),
                          }
                        : row,
                    ),
                  );
                }}
              />
            )}
            {tab === 'groups' && (
              <GroupsTab
                contact={c}
                allGroups={allGroups}
                canManage={canManage}
                onAdd={async (groupId) => {
                  await addToGroup(groupId, [c.id]);
                  await select(c.id); // refresh the contact (group_ids etc.)
                }}
                onRemove={async (groupId) => {
                  await removeFromGroup(groupId, [c.id]);
                  await select(c.id);
                }}
              />
            )}
          </div>

          {/* ── Right rail ──────────────────────────────────────── */}
          <aside className="space-y-4">
            <TagsRail
              contact={c}
              allTags={allTags}
              onAdd={(tagId) => addTag(c.id, tagId)}
              onRemove={(tagId) => removeTag(c.id, tagId)}
              canManage={canManage}
            />
            <QuickStatsRail contact={c} />
            <AdAttributionRail contact={c} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────

function ContactHeader({
  contact: c, canManage, onPriority, onRouting, onAssign, employees, agents, agentsEnabled,
}: {
  contact: Contact;
  canManage: boolean;
  onPriority: (p: Priority) => void;
  onRouting: (mode: RoutingMode, agentId?: number | null) => void;
  onAssign: (userId: number | null) => void;
  employees: Array<{ id: number; name: string }>;
  agents: Array<{ id: string | number; name: string }>;
  agentsEnabled: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<{ name: string; phone: string; email: string; company: string }>({
    name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '', company: c.company ?? '',
  });
  const [saving, setSaving] = useState(false);
  const { update } = useContactV2Store(useShallow(s => ({ update: s.update })));

  useEffect(() => {
    setEditing({ name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '', company: c.company ?? '' });
  }, [c.id, c.name, c.phone, c.email, c.company]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await update(c.id, {
        name: editing.name.trim() || undefined,
        phone: editing.phone.trim() || undefined,
        email: editing.email.trim() || undefined,
        company: editing.company.trim() || undefined,
      });
      setEditMode(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-border-color bg-card-bg p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Avatar */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/60 text-xl font-semibold text-white">
          {initials(c.name)}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          {editMode ? (
            <div className="space-y-2">
              <input
                value={editing.name}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base font-semibold text-text-primary focus:border-accent focus:outline-none"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={editing.phone}
                  onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <input
                  value={editing.email}
                  onChange={e => setEditing(p => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <input
                  value={editing.company}
                  onChange={e => setEditing(p => ({ ...p, company: e.target.value }))}
                  placeholder="Company"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-text-primary truncate">
                  {c.name || c.phone || `Contact #${c.id}`}
                </h1>
                {c.public_id && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-bg-primary px-1.5 py-0.5 text-[11px] font-mono text-text-secondary">
                    <Hash className="h-3 w-3" /> {c.public_id}
                  </span>
                )}
                {canManage && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-bg-primary hover:text-text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                {c.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {c.phone}</span>}
                {c.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {c.email}</span>}
                {c.company && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {c.company}</span>}
                {c.source && <span className="inline-flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5" /> {c.source}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Status chips row ──────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border-color pt-4">
        {/* Priority */}
        <ChipDropdown
          label="Priority"
          value={PRIORITY_LABEL[c.priority]}
          styleClass={PRIORITY_STYLE[c.priority]}
          disabled={!canManage}
          options={PRIORITY_OPTIONS.map(p => ({ value: p, label: PRIORITY_LABEL[p] }))}
          onChange={(v) => onPriority(v as Priority)}
        />
        {/* Routing — this is the DEFAULT for new channels this contact uses.
            Per-channel overrides live in the Channels tab and take precedence
            on actual message routing. */}
        <ChipDropdown
          label="Default routing"
          value={ROUTING_LABEL[c.routing_mode]}
          styleClass={ROUTING_STYLE[c.routing_mode]}
          disabled={!canManage}
          options={ROUTING_OPTIONS.map(m => ({ value: m, label: ROUTING_LABEL[m] }))}
          onChange={(v) => onRouting(v as RoutingMode, c.ai_agent_id)}
        />
        {/* AI Agent (only if routing=ai) */}
        {c.routing_mode === 'ai' && agentsEnabled && (
          <ChipDropdown
            label="Agent"
            value={agents.find(a => a.id === c.ai_agent_id)?.name ?? 'Default'}
            styleClass="bg-purple-500/10 text-purple-500 border-purple-500/30"
            disabled={!canManage}
            options={[{ value: '', label: 'Default' }, ...agents.map(a => ({ value: String(a.id), label: a.name }))]}
            onChange={(v) => onRouting('ai', v === '' ? null : Number(v))}
          />
        )}
        {/* Assignee */}
        <ChipDropdown
          label="Assigned"
          value={c.assigned_to_name ?? 'Unassigned'}
          styleClass="bg-bg-primary text-text-primary border-border-color"
          disabled={!canManage}
          options={[{ value: '', label: 'Unassigned' }, ...employees.map(e => ({ value: String(e.id), label: e.name }))]}
          onChange={(v) => onAssign(v === '' ? null : Number(v))}
        />
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <Clock className="h-3.5 w-3.5" /> Created {formatDate(c.created_at)}
        </span>
      </div>
    </div>
  );
}

function ChipDropdown({
  label, value, styleClass, options, onChange, disabled,
}: {
  label: string;
  value: string;
  styleClass: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`group relative inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${styleClass} ${disabled ? '' : 'cursor-pointer hover:opacity-90'}`}>
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
      {!disabled && (
        <select
          value=""
          onChange={(e) => { if (e.target.value !== '__noop') onChange(e.target.value); }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="__noop" disabled>Change…</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </label>
  );
}

// ────────────────────────────────────────────────────────────────
// Overview tab
// ────────────────────────────────────────────────────────────────

function OverviewTab({ contact: c }: { contact: Contact }) {
  const activeProcesses = c.active_processes ?? [];
  return (
    <div className="space-y-4">
      {/* Last message preview */}
      {c.last_message_preview && (
        <SectionCard title="Latest message" icon={MessageSquare}>
          <p className="text-sm text-text-primary line-clamp-3">{c.last_message_preview}</p>
          <p className="mt-1 text-xs text-text-secondary">{timeAgo(c.last_message_at)}</p>
          {c.latest_conversation_id && (
            <Link
              href={`/inbox?conversation=${c.latest_conversation_id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              View conversation <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </SectionCard>
      )}

      {/* Notes preview from contact.notes (the legacy summary field) */}
      {c.notes && (
        <SectionCard title="Summary" icon={FileText}>
          <p className="whitespace-pre-wrap text-sm text-text-primary">{c.notes}</p>
        </SectionCard>
      )}

      {/* Active deals */}
      <SectionCard title={`Active deals (${activeProcesses.length})`} icon={FolderKanban}>
        {activeProcesses.length === 0 ? (
          <p className="text-sm text-text-secondary">Not in any active pipeline.</p>
        ) : (
          <ul className="space-y-2">
            {activeProcesses.map((p, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm">
                <span className="text-text-primary truncate">{(p as { name?: string }).name ?? 'Deal'}</span>
                <span className="text-xs text-text-secondary">{(p as { stage?: string }).stage ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Followups */}
      {c.overdue_followup_count > 0 && (
        <SectionCard title="Follow-ups" icon={Calendar}>
          <p className="text-sm text-amber-600">
            ⚠ {c.overdue_followup_count} overdue follow-up{c.overdue_followup_count === 1 ? '' : 's'}.
          </p>
        </SectionCard>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Details tab — custom fields
// ────────────────────────────────────────────────────────────────

function DetailsTab({ contact: c }: { contact: Contact }) {
  const [defs, setDefs] = useState<ContactFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>(c.custom_fields ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Match the modal's Fields tab semantics: only show field defs that are
  // global (group_id === null) OR scoped to a group this contact belongs to.
  // Previously this tab rendered every field def in the business — which
  // surfaced editor inputs for fields that weren't applicable to the contact
  // (e.g. "Suppliers"-group fields on a "Customers" contact) and diverged
  // from the modal, confusing owners about which tab was right.
  useEffect(() => {
    setLoading(true);
    const contactGroupIds = new Set(c.group_ids ?? []);
    listFieldDefs()
      .then((all) => {
        const applicable = all.filter(
          (f) => f.group_id === null || contactGroupIds.has(f.group_id),
        );
        setDefs(applicable);
      })
      .catch(() => setDefs([]))
      .finally(() => setLoading(false));
  }, [c.id, (c.group_ids ?? []).join(',')]);

  useEffect(() => { setValues(c.custom_fields ?? {}); setDirty(false); }, [c.id, c.custom_fields]);

  const setField = (id: number, val: unknown) => {
    setValues(v => ({ ...v, [String(id)]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setContactCustomFields(c.id, values);
      setDirty(false);
    } finally { setSaving(false); }
  };

  if (loading) return <SkeletonCard />;

  return (
    <div className="space-y-4">
      <SectionCard title="Custom fields" icon={LayoutList}>
        {defs.length === 0 ? (
          <p className="text-sm text-text-secondary">No custom fields defined yet.</p>
        ) : (
          <div className="space-y-3">
            {defs.map(def => (
              <FieldEditor key={def.id} def={def} value={values[String(def.id)]} onChange={(v) => setField(def.id, v)} />
            ))}
            {dirty && (
              <div className="flex justify-end pt-2 border-t border-border-color">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes
                </button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* System fields */}
      <SectionCard title="System info" icon={Shield}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <DLRow label="Source" value={c.source ?? '—'} />
          <DLRow label="Contact source" value={c.contact_source ?? '—'} />
          <DLRow label="Public ID" value={c.public_id ?? '—'} />
          <DLRow label="Created" value={formatDateTime(c.created_at)} />
          <DLRow label="Updated" value={formatDateTime(c.updated_at)} />
        </dl>
      </SectionCard>
    </div>
  );
}

function FieldEditor({ def, value, onChange }: { def: ContactFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const v = value;
  const baseInput = "w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">
        {def.name}{def.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {def.field_type === 'textarea' ? (
        <textarea value={String(v ?? '')} onChange={e => onChange(e.target.value)} rows={3} className={`${baseInput} resize-none`} />
      ) : def.field_type === 'boolean' ? (
        <label className="inline-flex items-center gap-2 text-sm text-text-primary">
          <input type="checkbox" checked={Boolean(v)} onChange={e => onChange(e.target.checked)} className="h-4 w-4" /> Yes
        </label>
      ) : def.field_type === 'select' ? (
        <select value={String(v ?? '')} onChange={e => onChange(e.target.value)} className={baseInput}>
          <option value="">— Select —</option>
          {(def.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : def.field_type === 'multi_select' ? (
        <div className="flex flex-wrap gap-1.5">
          {(def.options ?? []).map(opt => {
            const arr = Array.isArray(v) ? v as string[] : [];
            const active = arr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(active ? arr.filter(x => x !== opt) : [...arr, opt])}
                className={`rounded-md border px-2 py-1 text-xs ${active ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-secondary hover:bg-bg-primary'}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : def.field_type === 'number' ? (
        <input type="number" value={String(v ?? '')} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} className={baseInput} />
      ) : def.field_type === 'date' ? (
        <input type="date" value={String(v ?? '')} onChange={e => onChange(e.target.value)} className={baseInput} />
      ) : (
        <input
          type={def.field_type === 'email' ? 'email' : def.field_type === 'url' ? 'url' : def.field_type === 'phone' ? 'tel' : 'text'}
          value={String(v ?? '')}
          onChange={e => onChange(e.target.value)}
          className={baseInput}
        />
      )}
    </div>
  );
}

function DLRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-color/50 py-1.5">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary truncate">{value}</dd>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Activity tab
// ────────────────────────────────────────────────────────────────

function ActivityTab({ activities, loading }: { activities: ContactV2State['activities']; loading: boolean }) {
  if (loading) return <SkeletonCard />;
  return (
    <SectionCard title="Activity timeline" icon={Activity}>
      {activities.length === 0 ? (
        <p className="text-sm text-text-secondary">No activity yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border-color pl-5">
          {activities.map(a => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-card-bg" />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-text-primary">{a.description || a.activity_type}</span>
                <span className="text-xs text-text-secondary">{timeAgo(a.created_at)}</span>
              </div>
              {a.user_name && <p className="text-xs text-text-secondary">by {a.user_name}</p>}
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────
// Notes tab
// ────────────────────────────────────────────────────────────────

function NotesTab({
  contact: _c, notes, loading, onAdd, onDelete,
}: {
  contact: Contact;
  notes: ContactV2State['notes'];
  loading: boolean;
  onAdd: (content: string, category?: string) => Promise<void>;
  onDelete: (noteId: number) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('general');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setSaving(true);
    try { await onAdd(text, category); setContent(''); }
    finally { setSaving(false); }
  };

  return (
    <SectionCard title={`Notes${notes.length ? ` (${notes.length})` : ''}`} icon={FileText}>
      <form onSubmit={submit} className="mb-4 space-y-2 border-b border-border-color pb-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note — preferences, complaints, follow-up context…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={e => setCategory(e.target.value as NoteCategory)}
            className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs"
          >
            {(Object.keys(NOTE_CATEGORY_LABELS) as NoteCategory[]).map(k => (
              <option key={k} value={k}>{NOTE_CATEGORY_LABELS[k]}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add note
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-text-secondary">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-border-color">
          {notes.map(n => (
            <li key={n.id} className="group py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${NOTE_CATEGORY_COLORS[n.category]}`}>
                      {NOTE_CATEGORY_LABELS[n.category]}
                    </span>
                    {n.source === 'ai' && (
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-500">🤖 AI</span>
                    )}
                    <span className="text-xs text-text-secondary">{formatDateTime(n.created_at)}</span>
                    {n.user_name && <span className="text-xs text-text-secondary">· {n.user_name}</span>}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-text-primary">{n.content}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => { setDeletingId(n.id); try { await onDelete(n.id); } finally { setDeletingId(null); } }}
                  disabled={deletingId === n.id}
                  className="shrink-0 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────
// Pipeline tab
// ────────────────────────────────────────────────────────────────

function PipelineTab({
  contact: _c, processes, loading, onMoveStage,
}: {
  contact: Contact;
  processes: ContactV2State['processes'];
  loading: boolean;
  onMoveStage: (entryId: number, stageId: number) => Promise<void>;
}) {
  if (loading) return <SkeletonCard />;
  if (processes.length === 0) {
    return (
      <SectionCard title="Pipeline" icon={Layers}>
        <p className="text-sm text-text-secondary">Not in any pipeline yet.</p>
      </SectionCard>
    );
  }
  return (
    <div className="space-y-3">
      {processes.map(p => (
        <div key={p.id} className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.process_color ?? '#888' }} />
                <h3 className="font-medium text-text-primary truncate">{p.process_name}</h3>
              </div>
              {p.title && <p className="mt-0.5 text-sm text-text-secondary">{p.title}</p>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
              {p.status}
            </span>
          </div>

          {/* Stages */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.process_stages.map(s => {
              const active = s.id === p.current_stage_id;
              return (
                <button
                  key={s.id}
                  disabled={active}
                  onClick={() => onMoveStage(p.id, s.id)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    active
                      ? 'border-accent bg-accent/10 text-accent font-medium'
                      : 'border-border-color text-text-secondary hover:bg-bg-primary'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-secondary sm:grid-cols-4">
            {p.expected_value != null && (
              <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> ₹{p.expected_value.toLocaleString()}</span>
            )}
            {p.expected_close_date && (
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.expected_close_date)}</span>
            )}
            {p.assigned_to_name && <span>👤 {p.assigned_to_name}</span>}
            {p.priority && <span>Priority: {p.priority}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Channels tab
// ────────────────────────────────────────────────────────────────

type AgentLite = { id: number | string; name: string };

function ChannelsTab({
  channels, loading, contactId, agents, canManage, onChannelUpdated,
}: {
  channels: ContactChannel[];
  loading: boolean;
  contactId: number;
  agents: AgentLite[];
  canManage: boolean;
  onChannelUpdated: (channelId: number, patch: { routing_mode?: RoutingMode | null; agent_id?: number | null }) => void;
}) {
  if (loading) return <SkeletonCard />;
  return (
    <SectionCard title="Channels & routing" icon={Wifi}>
      {channels.length === 0 ? (
        <p className="text-sm text-text-secondary">This contact hasn&apos;t messaged on any channel yet.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-text-secondary">
            Per-channel routing for this contact. Set each channel independently —
            e.g. <span className="font-medium text-text-primary">AI</span> on one WhatsApp number,
            <span className="font-medium text-text-primary"> Blocked</span> on another.
          </p>
          <ul className="divide-y divide-border-color">
            {channels.map(ch => (
              <ChannelRoutingRow
                key={ch.channel_id}
                channel={ch}
                contactId={contactId}
                agents={agents}
                canManage={canManage}
                onPatched={(patch) => onChannelUpdated(ch.channel_id, patch)}
              />
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

function ChannelRoutingRow({
  channel: ch, contactId, agents, canManage, onPatched,
}: {
  channel: ContactChannel;
  contactId: number;
  agents: AgentLite[];
  canManage: boolean;
  onPatched: (patch: { routing_mode?: RoutingMode | null; agent_id?: number | null }) => void;
}) {
  const [saving, setSaving] = useState<null | 'routing' | 'agent'>(null);
  const [error, setError] = useState<string | null>(null);

  const persist = async (
    patch: { routing_mode?: RoutingMode | null; agent_id?: number | null },
    which: 'routing' | 'agent',
  ) => {
    setSaving(which);
    setError(null);
    try {
      await contactsV2Service.setChannelRouting(contactId, ch.channel_id, patch);
      onPatched(patch);
    } catch (err) {
      setError((err as Error).message || 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  // "default" in the dropdown means routing_mode = null → use channel default.
  const routingValue: 'default' | RoutingMode = ch.routing_mode ?? 'default';

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {ch.display_name || ch.channel_name}
        </p>
        <p className="text-xs text-text-secondary">
          {ch.channel_type} · {ch.channel_identifier}
          {ch.channel_name && ch.channel_name !== ch.display_name && (
            <span className="text-text-secondary/70"> · on “{ch.channel_name}”</span>
          )}
        </p>
        {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Routing mode dropdown */}
        <div className="relative">
          <select
            value={routingValue}
            disabled={!canManage || saving !== null}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'default') void persist({ routing_mode: null }, 'routing');
              else void persist({ routing_mode: v as RoutingMode }, 'routing');
            }}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium focus:border-accent focus:outline-none disabled:opacity-60 ${
              ch.routing_mode
                ? ROUTING_STYLE[ch.routing_mode]
                : 'border-border-color bg-bg-primary text-text-secondary'
            }`}
            title="Per-channel routing for this contact. 'Default' uses the channel's own routing."
          >
            <option value="default">Use channel default</option>
            <option value="ai">{ROUTING_LABEL.ai}</option>
            <option value="manual">{ROUTING_LABEL.manual}</option>
            <option value="blocked">{ROUTING_LABEL.blocked}</option>
          </select>
        </div>

        {/* Agent dropdown — only relevant if routing is ai (or default + channel has agent) */}
        <div className="relative">
          <select
            value={ch.agent_id ? String(ch.agent_id) : 'default'}
            disabled={!canManage || saving !== null || ch.routing_mode === 'blocked'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'default') void persist({ agent_id: null }, 'agent');
              else void persist({ agent_id: Number(v) }, 'agent');
            }}
            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-[11px] font-medium text-text-primary focus:border-accent focus:outline-none disabled:opacity-60"
            title="Which agent handles this contact on this channel. 'Default' uses the channel's bound agent."
          >
            <option value="default">Default agent</option>
            {agents.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary" />}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────
// Groups tab
// ────────────────────────────────────────────────────────────────

function GroupsTab({
  contact: c, allGroups, canManage, onAdd, onRemove,
}: {
  contact: Contact;
  allGroups: ContactGroup[];
  canManage: boolean;
  onAdd: (groupId: number) => Promise<void>;
  onRemove: (groupId: number) => Promise<void>;
}) {
  const memberIds = useMemo(() => new Set(c.group_ids ?? []), [c.group_ids]);
  const memberGroups = useMemo(
    () => allGroups.filter((g) => memberIds.has(g.id)),
    [allGroups, memberIds],
  );
  const availableGroups = useMemo(
    () => allGroups.filter((g) => !memberIds.has(g.id)),
    [allGroups, memberIds],
  );

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState('');

  const handleAdd = async (groupId: number) => {
    if (!groupId) return;
    setPendingId(groupId);
    setError(null);
    try {
      await onAdd(groupId);
      setPicker('');
    } catch (e) {
      setError((e as Error).message || 'Failed to add to group');
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (groupId: number) => {
    setPendingId(groupId);
    setError(null);
    try {
      await onRemove(groupId);
    } catch (e) {
      setError((e as Error).message || 'Failed to remove from group');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <SectionCard title="Groups" icon={FolderKanban}>
      <p className="mb-3 text-xs text-text-secondary">
        Groups scope which custom fields apply to this contact and which routing
        rules fire at intake. System groups (auto-assigned) can&apos;t be removed
        here.
      </p>

      {/* Current memberships */}
      {memberGroups.length === 0 ? (
        <p className="text-sm text-text-secondary mb-3">Not a member of any group yet.</p>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {memberGroups.map((g) => {
            const isSystem = (g as ContactGroup & { is_system?: boolean }).is_system === true;
            return (
              <span
                key={g.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  isSystem
                    ? 'border-bg-secondary bg-bg-secondary text-text-secondary'
                    : 'border-indigo-300/60 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-900/30 dark:text-indigo-200'
                }`}
                style={!isSystem && g.color ? { borderColor: g.color, color: g.color, backgroundColor: g.color + '15' } : undefined}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: g.color ?? 'currentColor' }}
                />
                {g.name}
                {isSystem && (
                  <span title="Auto-assigned system group — managed by routing rules">
                    <Shield className="h-3 w-3 opacity-70" />
                  </span>
                )}
                {!isSystem && canManage && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(g.id)}
                    disabled={pendingId === g.id}
                    className="ml-0.5 opacity-70 hover:opacity-100 disabled:opacity-40"
                    title="Remove from group"
                  >
                    {pendingId === g.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Picker */}
      {canManage && (
        <div className="flex items-center gap-2">
          <select
            value={picker}
            onChange={(e) => {
              const v = e.target.value;
              setPicker(v);
              if (v) void handleAdd(Number(v));
            }}
            disabled={availableGroups.length === 0 || pendingId !== null}
            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none disabled:opacity-60"
          >
            <option value="">
              {availableGroups.length === 0 ? 'Already in every group' : 'Add to group…'}
            </option>
            {availableGroups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
          {pendingId !== null && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary" />
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-500">{error}</p>}
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────
// Right rail cards
// ────────────────────────────────────────────────────────────────

function TagsRail({
  contact: c, allTags, onAdd, onRemove, canManage,
}: {
  contact: Contact;
  allTags: { id: number; name: string; color: string | null }[];
  onAdd: (tagId: number) => Promise<void>;
  onRemove: (tagId: number) => Promise<void>;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const attachedIds = useMemo(() => new Set((c.tags ?? []).map(t => t.id)), [c.tags]);
  const candidates = allTags.filter(t => !attachedIds.has(t.id));

  return (
    <SectionCard title="Tags" icon={TagIcon}>
      <div className="flex flex-wrap gap-1.5">
        {(c.tags ?? []).length === 0 && !adding && (
          <p className="text-sm text-text-secondary">No tags.</p>
        )}
        {(c.tags ?? []).map(t => (
          <span
            key={t.id}
            className="group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: (t.color ?? '#88888820') + '20', color: t.color ?? undefined }}
          >
            {t.name}
            {canManage && (
              <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {canManage && (
          <button
            onClick={() => setAdding(v => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-color px-2 py-0.5 text-xs text-text-secondary hover:border-accent hover:text-accent"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border-color">
          {candidates.length === 0 ? (
            <p className="p-2 text-xs text-text-secondary">No more tags to add.</p>
          ) : candidates.map(t => (
            <button
              key={t.id}
              onClick={async () => { await onAdd(t.id); setAdding(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-primary"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color ?? '#888' }} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function QuickStatsRail({ contact: c }: { contact: Contact }) {
  return (
    <SectionCard title="At a glance" icon={Activity}>
      <dl className="space-y-2 text-sm">
        <DLRow label="Last message" value={timeAgo(c.last_message_at)} />
        <DLRow label="Overdue follow-ups" value={String(c.overdue_followup_count)} />
        <DLRow label="Active deals" value={String((c.active_processes ?? []).length)} />
      </dl>
    </SectionCard>
  );
}

function AdAttributionRail({ contact: c }: { contact: Contact }) {
  if (!c.ad_platform && !c.meta_ad_id && !c.meta_campaign_name) return null;
  return (
    <SectionCard title="Ad attribution" icon={Megaphone}>
      <dl className="space-y-2 text-sm">
        {c.ad_platform && <DLRow label="Platform" value={c.ad_platform} />}
        {c.meta_campaign_name && <DLRow label="Campaign" value={c.meta_campaign_name} />}
        {c.ad_headline && <DLRow label="Headline" value={c.ad_headline} />}
        {c.ctwa_clid && <DLRow label="CTWA CLID" value={c.ctwa_clid} />}
      </dl>
    </SectionCard>
  );
}

// ────────────────────────────────────────────────────────────────
// Generic helpers
// ────────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-secondary" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
      <div className="h-4 w-32 animate-pulse rounded bg-bg-primary" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-bg-primary" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-bg-primary" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-bg-primary" />
      </div>
    </div>
  );
}
