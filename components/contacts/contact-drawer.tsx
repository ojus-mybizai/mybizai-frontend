'use client';

import { useEffect, useState } from 'react';
import {
  X, Bot, UserCheck, UserX, Phone, Mail, Hash,
  ChevronDown, Check, Loader2, Globe, MessageSquare,
  RefreshCw, Clock, StickyNote, Trash2, Plus, Bell,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  contactsService,
  type Contact,
  type ContactChannelConfig,
  type RoutingMode,
} from '@/services/contacts';
// Minimal agent shape — compatible with both Agent and AgentSummary
export interface DrawerAgent {
  id: number | string;
  name: string;
  status: string;
}

import { PipelineEntriesPanel } from './pipeline-entries-panel';
import { AddToPipelineModal } from './add-to-pipeline-modal';

// ── Note / Activity types ──────────────────────────────────────

interface ContactNote {
  id: number;
  contact_id?: number;
  content: string;
  category?: string | null;
  source: string;
  created_at?: string | null;
}

interface ContactActivity {
  id: number;
  contact_id?: number;
  user_id?: number | null;
  user_name?: string | null;
  activity_type: string;
  description?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at?: string | null;
}

async function fetchContactNotes(contactId: number): Promise<ContactNote[]> {
  return apiFetch<ContactNote[]>(`/contacts/${contactId}/notes`);
}

async function createContactNote(contactId: number, content: string, category?: string): Promise<ContactNote> {
  return apiFetch<ContactNote>(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content, category: category || 'general' }),
  });
}

async function deleteContactNote(contactId: number, noteId: number): Promise<void> {
  await apiFetch<void>(`/contacts/${contactId}/notes/${noteId}`, { method: 'DELETE' });
}

async function fetchContactActivities(contactId: number): Promise<ContactActivity[]> {
  return apiFetch<ContactActivity[]>(`/contacts/${contactId}/activities`);
}

interface ContactFollowUp {
  id: number;
  contact_id?: number | null;
  status: string;
  delivery_mode: string;
  scheduled_at: string;
  sent_at?: string | null;
  message_text: string;
  channel_type?: string | null;
}

async function fetchContactFollowUps(contactId: number): Promise<ContactFollowUp[]> {
  const res = await apiFetch<{ items: ContactFollowUp[] }>(`/contacts/${contactId}/followups`);
  return res.items ?? [];
}

async function createContactFollowUp(
  contactId: number,
  payload: { message_text: string; scheduled_at: string; delivery_mode?: string; channel_id?: number; channel_type?: string }
): Promise<ContactFollowUp> {
  return apiFetch<ContactFollowUp>(`/contacts/${contactId}/followups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ACTIVITY_ICONS: Record<string, string> = {
  note_added: '📝',
  stage_changed: '🔀',
  pipeline_added: '➕',
  pipeline_removed: '➖',
  pipeline_advanced: '⏩',
  call_logged: '📞',
  email_sent: '📧',
  default: '🔹',
};

// ── helpers ────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp:  '📱',
  instagram: '📸',
  messenger: '💬',
  telegram:  '✈️',
  webchat:   '🌐',
};

const ROUTING_LABELS: Record<RoutingMode, string> = {
  ai: 'AI Agent', manual: 'Manual', blocked: 'Blocked',
};
const ROUTING_COLORS: Record<RoutingMode, string> = {
  ai:      'text-green-800 bg-green-50 border-green-300',
  manual:  'text-amber-800 bg-amber-50 border-amber-300',
  blocked: 'text-red-600  bg-red-50   border-red-300',
};

function RoutingIcon({ mode }: { mode: RoutingMode }) {
  if (mode === 'ai')      return <Bot      className="w-3.5 h-3.5" />;
  if (mode === 'blocked') return <UserX    className="w-3.5 h-3.5" />;
  return                         <UserCheck className="w-3.5 h-3.5" />;
}

// ── types ──────────────────────────────────────────────────────

interface Props {
  contact: Contact;
  agents: DrawerAgent[];
  onClose: () => void;
  onContactUpdated: (updated: Contact) => void;
}

// ── main component ─────────────────────────────────────────────

type DrawerTab = 'routing' | 'timeline' | 'notes' | 'followups';

export function ContactDrawer({ contact, agents, onClose, onContactUpdated }: Props) {
  const [activeTab,       setActiveTab]       = useState<DrawerTab>('routing');
  const [channels,        setChannels]        = useState<ContactChannelConfig[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [globalUpdating,  setGlobalUpdating]  = useState(false);
  const [updatingCh,      setUpdatingCh]      = useState<number | null>(null);
  const [showAddPipeline, setShowAddPipeline] = useState(false);
  const [pipelineKey,     setPipelineKey]     = useState(0);

  // Timeline state
  const [activities,        setActivities]        = useState<ContactActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesFetched, setActivitiesFetched] = useState(false);

  // Notes state
  const [notes,        setNotes]        = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesFetched, setNotesFetched] = useState(false);
  const [noteInput,    setNoteInput]    = useState('');
  const [noteCategory, setNoteCategory] = useState('general');
  const [noteSaving,   setNoteSaving]   = useState(false);
  const [deletingNote, setDeletingNote] = useState<number | null>(null);

  // Follow-ups state
  const [followUps,        setFollowUps]        = useState<ContactFollowUp[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [followUpsFetched, setFollowUpsFetched] = useState(false);
  const [fuText,           setFuText]           = useState('');
  const [fuDate,           setFuDate]           = useState('');
  const [fuSaving,         setFuSaving]         = useState(false);

  const activeAgents = agents.filter(a => a.status === 'active');

  // Load per-channel configs when drawer opens
  useEffect(() => {
    setChannelsLoading(true);
    contactsService.getChannels(contact.id)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false));
  }, [contact.id]);

  // Lazy-load timeline when tab is opened
  useEffect(() => {
    if (activeTab === 'timeline' && !activitiesFetched) {
      setActivitiesLoading(true);
      fetchContactActivities(contact.id)
        .then(data => { setActivities(data); setActivitiesFetched(true); })
        .catch(() => setActivitiesFetched(true))
        .finally(() => setActivitiesLoading(false));
    }
  }, [activeTab, activitiesFetched, contact.id]);

  // Lazy-load notes when tab is opened
  useEffect(() => {
    if (activeTab === 'notes' && !notesFetched) {
      setNotesLoading(true);
      fetchContactNotes(contact.id)
        .then(data => { setNotes(data); setNotesFetched(true); })
        .catch(() => setNotesFetched(true))
        .finally(() => setNotesLoading(false));
    }
  }, [activeTab, notesFetched, contact.id]);

  // Lazy-load follow-ups when tab is opened
  useEffect(() => {
    if (activeTab === 'followups' && !followUpsFetched) {
      setFollowUpsLoading(true);
      fetchContactFollowUps(contact.id)
        .then(data => { setFollowUps(data); setFollowUpsFetched(true); })
        .catch(() => setFollowUpsFetched(true))
        .finally(() => setFollowUpsLoading(false));
    }
  }, [activeTab, followUpsFetched, contact.id]);

  // ── Apply-to-all routing update ───────────────────────────
  const handleGlobalRouting = async (mode: RoutingMode, agentId?: number | null) => {
    setGlobalUpdating(true);
    try {
      const updated = await contactsService.updateRouting(contact.id, mode, agentId);
      onContactUpdated(updated);
      // Refresh per-channel list so rows show the newly applied values
      contactsService.getChannels(contact.id)
        .then(setChannels)
        .catch(() => {});
    } finally {
      setGlobalUpdating(false);
    }
  };

  // ── Per-channel routing update ─────────────────────────────
  const handleChannelRouting = async (
    ch: ContactChannelConfig,
    mode: RoutingMode | null,
    agentId?: number | null,
  ) => {
    setUpdatingCh(ch.channelId);
    try {
      await contactsService.updateChannelRouting(contact.id, ch.channelId, mode, agentId);
      setChannels(prev => prev.map(c =>
        c.channelId === ch.channelId
          ? { ...c, routingMode: mode, agentId: mode === 'ai' ? (agentId ?? null) : null,
              agentName: mode === 'ai' ? (agents.find(a => a.id === agentId)?.name ?? null) : null }
          : c
      ));
    } finally {
      setUpdatingCh(null);
    }
  };

  const handleAddNote = async () => {
    const content = noteInput.trim();
    if (!content || noteSaving) return;
    setNoteSaving(true);
    try {
      const note = await createContactNote(contact.id, content, noteCategory);
      setNotes(prev => [note, ...prev]);
      setNoteInput('');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    setDeletingNote(noteId);
    try {
      await deleteContactNote(contact.id, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } finally {
      setDeletingNote(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] z-50 bg-bg-primary border-l border-border-color shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm flex-shrink-0">
              {(contact.name ?? contact.phone ?? '?')[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-primary-text text-sm leading-tight">
                {contact.name ?? <span className="text-secondary-text italic font-normal">No name</span>}
              </p>
              <p className="text-xs text-secondary-text mt-0.5">
                {contact.contactTypeName ?? 'Contact'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-secondary-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contact quick info */}
        <div className="px-5 py-3 border-b border-border-color flex-shrink-0 flex flex-wrap gap-x-4 gap-y-1">
          {contact.phone && (
            <div className="flex items-center gap-1.5 text-xs text-secondary-text">
              <Phone className="w-3 h-3" />{contact.phone}
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-1.5 text-xs text-secondary-text">
              <Mail className="w-3 h-3" />{contact.email}
            </div>
          )}
          {contact.contactSource && (
            <div className="flex items-center gap-1.5 text-xs text-secondary-text">
              <Hash className="w-3 h-3" />{contact.contactSource}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border-color flex-shrink-0">
          {([
            ['routing',   'Routing',    <Globe      key="r" className="w-3.5 h-3.5" />],
            ['timeline',  'Timeline',   <Clock      key="t" className="w-3.5 h-3.5" />],
            ['notes',     'Notes',      <StickyNote key="n" className="w-3.5 h-3.5" />],
            ['followups', 'Follow-ups', <Bell       key="f" className="w-3.5 h-3.5" />],
          ] as [DrawerTab, string, React.ReactNode][]).map(([tab, label, icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-secondary-text hover:text-primary-text'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Routing tab ──────────────────────────────────────── */}
          {activeTab === 'routing' && (
            <>
              {/* Per-channel routing */}
              <section className="px-5 py-4 border-b border-border-color">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-secondary-text" />
                  <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide">
                    Per-Channel Routing
                  </p>
                </div>
                <p className="text-xs text-secondary-text mb-3 ml-5">
                  Each channel routes independently. Unset channels use their channel&apos;s default AI agent.
                </p>
                {channelsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-secondary-text" />
                  </div>
                ) : channels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <MessageSquare className="w-7 h-7 text-secondary-text/30" />
                    <p className="text-xs text-secondary-text max-w-[220px]">
                      No channel activity yet. Per-channel settings will appear once this contact sends a message.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {channels.map(ch => (
                      <ChannelRoutingRow
                        key={ch.channelId}
                        ch={ch}
                        agents={activeAgents}
                        updating={updatingCh === ch.channelId}
                        onChange={handleChannelRouting}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Apply to all channels */}
              <section className="px-5 py-4 border-b border-border-color">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-3.5 h-3.5 text-secondary-text" />
                  <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide">
                    Apply to All Channels
                  </p>
                </div>
                <p className="text-xs text-secondary-text mb-3 ml-5">
                  Set the same routing on every channel at once.
                </p>
                <GlobalRoutingPicker
                  contact={contact}
                  agents={activeAgents}
                  updating={globalUpdating}
                  onChange={handleGlobalRouting}
                />
              </section>

              {/* Pipelines */}
              <section className="px-5 py-4">
                <PipelineEntriesPanel
                  key={pipelineKey}
                  entityType="contact"
                  entityId={contact.id}
                  onAddClick={() => setShowAddPipeline(true)}
                />
              </section>
            </>
          )}

          {/* ── Timeline tab ─────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div className="px-5 py-4">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary-text" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Clock className="w-8 h-8 text-secondary-text/30" />
                  <p className="text-sm text-secondary-text">No activity yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border-color" />
                  <div className="space-y-4">
                    {activities.map(a => (
                      <div key={a.id} className="flex gap-3 relative">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-bg-secondary border border-border-color flex items-center justify-center text-sm z-10">
                          {ACTIVITY_ICONS[a.activity_type] ?? ACTIVITY_ICONS.default}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-xs text-primary-text leading-snug">
                            {a.description ?? a.activity_type.replace(/_/g, ' ')}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {a.user_name && (
                              <span className="text-xs text-secondary-text">{a.user_name}</span>
                            )}
                            <span className="text-xs text-secondary-text/60">{formatRelativeTime(a.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes tab ────────────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div className="px-5 py-4 space-y-4">
              {/* Add note form */}
              <div className="space-y-2">
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  rows={3}
                  placeholder="Add a note..."
                  className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text placeholder:text-secondary-text/60 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={noteCategory}
                    onChange={e => setNoteCategory(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-1 focus:ring-accent/30"
                  >
                    {['general', 'preference', 'complaint', 'follow-up'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim() || noteSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {noteSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                </div>
              </div>

              {/* Notes list */}
              {notesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary-text" />
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <StickyNote className="w-8 h-8 text-secondary-text/30" />
                  <p className="text-sm text-secondary-text">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map(n => (
                    <div key={n.id} className="rounded-lg border border-border-color bg-bg-secondary/40 p-3 group">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm text-primary-text whitespace-pre-wrap leading-relaxed">
                          {n.content}
                        </p>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          disabled={deletingNote === n.id}
                          className="opacity-0 group-hover:opacity-100 p-1 text-secondary-text hover:text-red-500 transition-all flex-shrink-0"
                        >
                          {deletingNote === n.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {n.category && n.category !== 'general' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary border border-border-color text-secondary-text capitalize">
                            {n.category}
                          </span>
                        )}
                        <span className="text-xs text-secondary-text/60">{formatRelativeTime(n.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Follow-ups tab ─────────────────────────────────── */}
          {activeTab === 'followups' && (
            <div className="p-4 space-y-4">
              {/* Create form */}
              <div className="rounded-lg border border-border-color bg-bg-secondary/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide">Schedule Follow-up</p>
                <textarea
                  rows={3}
                  value={fuText}
                  onChange={e => setFuText(e.target.value)}
                  placeholder="Message to send…"
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-primary-text placeholder:text-secondary-text/60 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={fuDate}
                    onChange={e => setFuDate(e.target.value)}
                    className="flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button
                    disabled={fuSaving || !fuText.trim() || !fuDate}
                    onClick={async () => {
                      if (!fuText.trim() || !fuDate) return;
                      setFuSaving(true);
                      try {
                        const iso = new Date(fuDate).toISOString();
                        const fu = await createContactFollowUp(contact.id, {
                          message_text: fuText.trim(),
                          scheduled_at: iso,
                          delivery_mode: 'manual',
                        });
                        setFollowUps(prev => [...prev, fu]);
                        setFuText('');
                        setFuDate('');
                      } catch {
                        // ignore
                      } finally {
                        setFuSaving(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
                  >
                    {fuSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Schedule
                  </button>
                </div>
              </div>

              {/* List */}
              {followUpsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary-text" />
                </div>
              ) : followUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Bell className="w-8 h-8 text-secondary-text/30" />
                  <p className="text-sm text-secondary-text">No follow-ups scheduled</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {followUps.map(fu => {
                    const statusColors: Record<string, string> = {
                      scheduled:      'text-blue-600 bg-blue-50 border-blue-300',
                      pending_manual: 'text-amber-800 bg-amber-50 border-amber-300',
                      sent:           'text-green-800 bg-green-50 border-green-300',
                      cancelled:      'text-secondary-text bg-bg-secondary border-border-color',
                      failed:         'text-red-600 bg-red-50 border-red-300',
                    };
                    const color = statusColors[fu.status] ?? statusColors.cancelled;
                    return (
                      <div key={fu.id} className="rounded-lg border border-border-color bg-bg-secondary/40 p-3">
                        <div className="flex items-start gap-2">
                          <Bell className="w-3.5 h-3.5 mt-0.5 text-secondary-text flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary-text whitespace-pre-wrap leading-relaxed">{fu.message_text}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${color}`}>
                                {fu.status.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-secondary-text/70">
                                {new Date(fu.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {fu.channel_type && (
                                <span className="text-xs text-secondary-text/60 capitalize">{fu.channel_type}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Add to Pipeline modal */}
      {showAddPipeline && (
        <AddToPipelineModal
          entityType="contact"
          entityId={contact.id}
          entityName={contact.name}
          entityPhone={contact.phone}
          onClose={() => setShowAddPipeline(false)}
          onAdded={() => setPipelineKey(k => k + 1)}
        />
      )}
    </>
  );
}


// ── Global routing picker ──────────────────────────────────────

function GlobalRoutingPicker({
  contact, agents, updating, onChange,
}: {
  contact: Contact;
  agents: DrawerAgent[];
  updating: boolean;
  onChange: (mode: RoutingMode, agentId?: number | null) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const handleMode = (mode: RoutingMode) => {
    setOpen(false);
    if (mode === 'ai') { setAgentOpen(true); }
    else { onChange(mode, null); }
  };

  return (
    <div className="relative flex items-center gap-2 flex-wrap">
      {/* Mode button */}
      <button
        disabled={updating}
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${ROUTING_COLORS[contact.routingMode]} ${updating ? 'opacity-50 cursor-wait' : 'hover:opacity-80'}`}
      >
        {updating
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <RoutingIcon mode={contact.routingMode} />
        }
        {ROUTING_LABELS[contact.routingMode]}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Agent name */}
      {contact.routingMode === 'ai' && contact.aiAgentId && (
        <span className="text-xs text-secondary-text truncate max-w-[160px]">
          {agents.find(a => a.id === contact.aiAgentId)?.name ?? `Agent #${contact.aiAgentId}`}
        </span>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-44">
            {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => handleMode(mode)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${contact.routingMode === mode ? 'font-semibold text-accent' : 'text-primary-text'}`}
              >
                <RoutingIcon mode={mode} />
                {ROUTING_LABELS[mode]}
                {contact.routingMode === mode && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}

      {agentOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAgentOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-52 max-h-52 overflow-y-auto">
            <p className="px-3.5 py-2 text-xs text-secondary-text font-semibold uppercase tracking-wide border-b border-border-color">Assign agent</p>
            {agents.length === 0
              ? <p className="px-3.5 py-3 text-xs text-secondary-text">No active agents</p>
              : agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setAgentOpen(false); onChange('ai', Number(a.id)); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-primary-text hover:bg-bg-secondary text-left transition-colors"
                >
                  <Bot className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  {a.name}
                  {contact.aiAgentId === Number(a.id) && <Check className="w-3.5 h-3.5 ml-auto text-accent" />}
                </button>
              ))
            }
            <button onClick={() => setAgentOpen(false)} className="w-full px-3.5 py-2 text-xs text-secondary-text hover:bg-bg-secondary text-left border-t border-border-color">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}


// ── Per-channel routing row ────────────────────────────────────

function ChannelRoutingRow({
  ch, agents, updating, onChange,
}: {
  ch: ContactChannelConfig;
  agents: DrawerAgent[];
  updating: boolean;
  onChange: (ch: ContactChannelConfig, mode: RoutingMode | null, agentId?: number | null) => void;
}) {
  const [open,      setOpen]      = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  // null = channel default (AI with channel's configured agent)
  const effectiveMode = ch.routingMode ?? 'ai';
  const isDefault     = ch.routingMode === null;

  const handleMode = (mode: RoutingMode | 'default') => {
    setOpen(false);
    if (mode === 'default') {
      onChange(ch, null);        // clear override → channel default AI
    } else if (mode === 'ai') {
      setAgentOpen(true);
    } else {
      onChange(ch, mode, null);
    }
  };

  // Which agent name to show
  const agentDisplay = ch.agentId
    ? (ch.agentName ?? `Agent #${ch.agentId}`)
    : ch.channelDefaultAgentName ?? null;

  return (
    <div className="rounded-xl border border-border-color bg-bg-secondary/40 p-3">
      {/* Channel header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base leading-none">{CHANNEL_ICONS[ch.channelType] ?? '📡'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-text truncate">{ch.channelName}</p>
          <p className="text-xs text-secondary-text truncate">{ch.channelIdentifier}</p>
        </div>
        {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-text flex-shrink-0" />}
      </div>

      {/* Routing control */}
      <div className="relative flex items-center gap-2 flex-wrap">
        <button
          disabled={updating}
          onClick={() => setOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${ROUTING_COLORS[effectiveMode]} ${isDefault ? 'opacity-70 border-dashed' : ''} ${updating ? 'cursor-wait' : 'hover:opacity-80'}`}
        >
          <RoutingIcon mode={effectiveMode} />
          {isDefault ? 'Channel default' : ROUTING_LABELS[effectiveMode]}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {/* Agent name for AI mode */}
        {effectiveMode === 'ai' && (
          <span className="text-xs text-secondary-text truncate max-w-[140px]">
            {agentDisplay
              ? agentDisplay
              : <span className="italic text-amber-600">No agent set</span>
            }
          </span>
        )}

        {/* Routing dropdown */}
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-52">
              {/* Channel default option */}
              <button
                onClick={() => handleMode('default')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${isDefault ? 'font-semibold text-accent' : 'text-primary-text'}`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-secondary-text" />
                Channel default (AI)
                {isDefault && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
              <div className="border-t border-border-color my-1" />
              {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleMode(mode)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${!isDefault && ch.routingMode === mode ? 'font-semibold text-accent' : 'text-primary-text'}`}
                >
                  <RoutingIcon mode={mode} />
                  {ROUTING_LABELS[mode]}
                  {!isDefault && ch.routingMode === mode && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Agent picker for AI mode */}
        {agentOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setAgentOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-52 max-h-52 overflow-y-auto">
              <p className="px-3.5 py-2 text-xs text-secondary-text font-semibold uppercase tracking-wide border-b border-border-color">Assign agent for this channel</p>
              {agents.length === 0
                ? <p className="px-3.5 py-3 text-xs text-secondary-text">No active agents</p>
                : agents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setAgentOpen(false); onChange(ch, 'ai', Number(a.id)); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-primary-text hover:bg-bg-secondary text-left transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    {a.name}
                    {ch.agentId === Number(a.id) && <Check className="w-3.5 h-3.5 ml-auto text-accent" />}
                  </button>
                ))
              }
              <button onClick={() => setAgentOpen(false)} className="w-full px-3.5 py-2 text-xs text-secondary-text hover:bg-bg-secondary text-left border-t border-border-color">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
