'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X, User, Phone, Mail, Building2, Tag, Bot, MessageSquare,
  Clock, ChevronRight, Plus, Trash2, Loader2, ToggleLeft,
  ToggleRight, Activity, FileText, Layers, Wifi, Edit2, Check,
  AlertCircle, Megaphone, Calendar, DollarSign, ExternalLink,
  FolderKanban, UserCheck, UserX, ChevronDown, LayoutList,
  Lock, Hash, Link, AlignLeft, Type,
} from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import { formatDate as fmtDate } from '@/lib/format-date';
import type {
  Contact, ContactActivity, ContactNote, ContactProcessEntry,
  ContactChannel, RoutingMode,
} from '@/services/contacts-v2';
import { contactsV2Service, contactGroupService } from '@/services/contacts-v2';
import type { ContactGroup } from '@/services/contacts-v2';
import {
  listFieldDefs, setContactCustomFields,
  type ContactFieldDef, type FieldType, FIELD_TYPE_LABELS,
} from '@/services/contact-field-defs';

interface Props {
  contactId: number;
  contact?: Contact | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
}

type Tab = 'overview' | 'activity' | 'notes' | 'channels' | 'pipeline' | 'fields';

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  Icon: User },
  { id: 'fields',    label: 'Fields',    Icon: LayoutList },
  { id: 'activity',  label: 'Activity',  Icon: Activity },
  { id: 'notes',     label: 'Notes',     Icon: FileText },
  { id: 'channels',  label: 'Channels',  Icon: Wifi },
  { id: 'pipeline',  label: 'Pipeline',  Icon: Layers },
];

const PRIORITY_COLORS: Record<string, string> = {
  hot:    'bg-red-500/10 text-red-400 border-red-500/20',
  high:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const PRIORITY_LABEL: Record<string, string> = {
  hot: '🔥 Hot', high: '↑ High', medium: '— Medium', low: '↓ Low',
};

const ROUTING_COLORS: Record<RoutingMode, string> = {
  ai:      'bg-green-500/10 text-green-400',
  manual:  'bg-yellow-500/10 text-yellow-400',
  blocked: 'bg-red-500/10 text-red-400',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(iso: string | null) {
  return fmtDate(iso);
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  contact, onEdit, contactId,
}: {
  contact: Contact;
  onEdit: () => void;
  contactId: number;
}) {
  const { update, updateRouting, groups, loadGroups, addToGroup, removeFromGroup } = useContactV2Store();
  const [editingPriority, setEditingPriority] = useState(false);
  const [editingRouting, setEditingRouting] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);
  const [removingFromGroup, setRemovingFromGroup] = useState<number | null>(null);

  useEffect(() => {
    if (groups.length === 0) loadGroups();
  }, []);

  // Fetch which groups this contact belongs to
  useEffect(() => {
    if (groups.length === 0) return;
    setLoadingGroups(true);
    const fetchMemberships = async () => {
      const memberships: ContactGroup[] = [];
      for (const g of groups) {
        try {
          const detail = await contactGroupService.getDetail(g.id);
          if (detail.members.some(m => m.id === contactId)) memberships.push(g);
        } catch { /* skip */ }
      }
      setContactGroups(memberships);
      setLoadingGroups(false);
    };
    fetchMemberships();
  }, [groups.length, contactId]);

  const handlePriorityChange = async (priority: string) => {
    setSavingPriority(true);
    try {
      await update(contactId, { priority: priority as 'hot' | 'high' | 'medium' | 'low' });
    } finally {
      setSavingPriority(false);
      setEditingPriority(false);
    }
  };

  const handleRoutingChange = async (mode: RoutingMode) => {
    setSavingRouting(true);
    try {
      await updateRouting(contactId, mode);
    } finally {
      setSavingRouting(false);
      setEditingRouting(false);
    }
  };

  const handleAddToGroup = async (groupId: number) => {
    setAddingToGroup(groupId);
    try {
      await addToGroup(groupId, [contactId]);
      setContactGroups(prev => {
        const g = groups.find(g => g.id === groupId);
        if (g && !prev.some(p => p.id === groupId)) return [...prev, g];
        return prev;
      });
      setShowAddGroup(false);
    } finally {
      setAddingToGroup(null);
    }
  };

  const handleRemoveFromGroup = async (groupId: number) => {
    setRemovingFromGroup(groupId);
    try {
      await removeFromGroup(groupId, [contactId]);
      setContactGroups(prev => prev.filter(g => g.id !== groupId));
    } finally {
      setRemovingFromGroup(null);
    }
  };

  const availableGroups = groups.filter(g => !contactGroups.some(cg => cg.id === g.id));

  return (
    <div className="space-y-5 py-4">
      {/* Identity card */}
      <div className="rounded-xl border border-border-color bg-bg-secondary p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-base shrink-0">
              {(contact.name ?? contact.phone ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{contact.name ?? '—'}</p>
              <p className="text-xs text-text-secondary">{contact.phone ?? contact.email ?? 'No contact info'}</p>
            </div>
          </div>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-card-bg text-text-secondary">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {contact.email && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.company && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.company}</span>
            </div>
          )}
          {contact.contact_source && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="capitalize">{contact.contact_source.replace('_', ' ')}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Added {formatDate(contact.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Priority + Routing — clickable */}
      <div className="grid grid-cols-2 gap-2">
        {/* Priority — click to change */}
        <div className="relative rounded-xl border border-border-color bg-bg-secondary p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1">Priority</p>
          <button
            onClick={() => setEditingPriority(o => !o)}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[contact.priority] ?? ''} hover:opacity-80 transition-opacity`}
          >
            {savingPriority ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
            {PRIORITY_LABEL[contact.priority] ?? contact.priority}
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {editingPriority && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 bg-card-bg border border-border-color rounded-xl shadow-xl py-1 min-w-[110px]">
              {(['hot', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-secondary transition-colors ${
                    contact.priority === p ? 'font-semibold text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {contact.priority === p && <Check className="h-3 w-3 flex-shrink-0 text-accent" />}
                  <span className={contact.priority !== p ? 'ml-5' : ''}>{PRIORITY_LABEL[p]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Routing — click to toggle */}
        <div className="relative rounded-xl border border-border-color bg-bg-secondary p-3 text-center">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1">Routing</p>
          <button
            onClick={() => setEditingRouting(o => !o)}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROUTING_COLORS[contact.routing_mode]} hover:opacity-80 transition-opacity`}
          >
            {savingRouting ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : contact.routing_mode === 'ai' ? (
              <Bot className="h-2.5 w-2.5" />
            ) : contact.routing_mode === 'blocked' ? (
              <UserX className="h-2.5 w-2.5" />
            ) : (
              <UserCheck className="h-2.5 w-2.5" />
            )}
            {contact.routing_mode === 'ai' ? 'AI' : contact.routing_mode === 'blocked' ? 'Blocked' : 'Manual'}
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {editingRouting && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 bg-card-bg border border-border-color rounded-xl shadow-xl py-1 min-w-[110px]">
              {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(mode => {
                const Icon = mode === 'ai' ? Bot : mode === 'blocked' ? UserX : UserCheck;
                return (
                  <button
                    key={mode}
                    onClick={() => handleRoutingChange(mode)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-secondary transition-colors ${
                      contact.routing_mode === mode ? 'font-semibold text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {contact.routing_mode === mode
                      ? <Check className="h-3 w-3 flex-shrink-0 text-accent" />
                      : <Icon className="h-3 w-3 flex-shrink-0" />
                    }
                    <span>{mode === 'ai' ? 'AI Agent' : mode === 'manual' ? 'Manual' : 'Blocked'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide flex items-center gap-1.5">
            <FolderKanban className="h-3 w-3" />
            Groups
          </p>
          <button
            onClick={() => setShowAddGroup(o => !o)}
            className="p-0.5 rounded-md text-text-secondary hover:text-accent transition-colors"
            title="Add to group"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Current group memberships */}
        <div className="flex flex-wrap gap-1.5">
          {contactGroups.map(g => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: g.color ?? '#6366f1' }}
            >
              {g.name}
              <button
                onClick={() => handleRemoveFromGroup(g.id)}
                disabled={removingFromGroup === g.id}
                className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 transition-colors"
              >
                {removingFromGroup === g.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
              </button>
            </span>
          ))}
          {contactGroups.length === 0 && !loadingGroups && (
            <p className="text-xs text-text-secondary/50 italic">Not in any group</p>
          )}
        </div>

        {/* Add to group dropdown */}
        {showAddGroup && availableGroups.length > 0 && (
          <div className="mt-2 border-t border-border-color pt-2 space-y-1">
            <p className="text-[10px] text-text-secondary mb-1.5">Add to group:</p>
            {availableGroups.map(g => (
              <button
                key={g.id}
                onClick={() => handleAddToGroup(g.id)}
                disabled={addingToGroup === g.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-card-bg transition-colors text-text-primary text-left"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: g.color ?? '#6366f1' }}
                />
                {g.name}
                <span className="ml-auto text-text-secondary/60">{g.member_count}</span>
                {addingToGroup === g.id && <Loader2 className="h-3 w-3 animate-spin text-text-secondary" />}
              </button>
            ))}
            {availableGroups.length === 0 && (
              <p className="text-xs text-text-secondary/50 italic px-2">Already in all groups</p>
            )}
          </div>
        )}
      </div>

      {/* Assignment */}
      {contact.assigned_member_id && (
        <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-wide">Assigned To</p>
            <p className="text-sm font-medium text-text-primary mt-0.5">{contact.assigned_member_name ?? `Member #${contact.assigned_member_id}`}</p>
          </div>
          {contact.routing_mode === 'ai' && (
            <div className="text-right">
              <p className="text-[10px] text-text-secondary uppercase tracking-wide">Routing</p>
              <div className="flex items-center gap-1 mt-0.5 justify-end">
                <Bot className="h-3 w-3 text-accent" />
                <p className="text-xs text-accent">AI Agent</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-1.5">Notes</p>
          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border-color bg-bg-secondary p-3 text-center">
          <p className="text-lg font-bold text-text-primary">{contact.active_processes?.length ?? 0}</p>
          <p className="text-[10px] text-text-secondary">Active Pipelines</p>
        </div>
        <div className="rounded-xl border border-border-color bg-bg-secondary p-3 text-center">
          <p className="text-lg font-bold text-text-primary">{contact.tags.length}</p>
          <p className="text-[10px] text-text-secondary">Tags</p>
        </div>
        <div className="rounded-xl border border-border-color bg-bg-secondary p-3 text-center">
          <p className={`text-lg font-bold ${contact.overdue_followup_count > 0 ? 'text-red-400' : 'text-text-primary'}`}>
            {contact.overdue_followup_count}
          </p>
          <p className="text-[10px] text-text-secondary">Overdue</p>
        </div>
      </div>

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div>
          <p className="text-[10px] text-text-secondary uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                style={{ backgroundColor: tag.color ?? '#6366f1' }}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ad Attribution */}
      {contact.ad_platform && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Megaphone className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-xs font-semibold text-purple-400">Meta Ad Attribution</p>
          </div>
          <div className="space-y-1 text-xs text-text-secondary">
            {contact.meta_campaign_name && <p>Campaign: <span className="text-text-primary">{contact.meta_campaign_name}</span></p>}
            {contact.ctwa_clid && <p>CTWA ID: <span className="text-text-primary font-mono text-[10px]">{contact.ctwa_clid}</span></p>}
            {contact.ad_headline && <p className="text-text-primary italic">"{contact.ad_headline}"</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ activities, loading }: { activities: ContactActivity[]; loading: boolean }) {
  const ICON_MAP: Record<string, React.ElementType> = {
    contact_created: User,
    note_added: FileText,
    stage_changed: ChevronRight,
    assignment_change: User,
    priority_change: AlertCircle,
    tag_added: Tag,
    tag_removed: Tag,
    routing_changed: Wifi,
    process_added: Layers,
    process_stage_changed: Layers,
  };

  if (loading) return <LoadingState />;
  if (activities.length === 0) return <EmptyState icon={Activity} text="No activity yet" />;

  return (
    <div className="py-4 space-y-1">
      {activities.map(a => {
        const Icon = ICON_MAP[a.activity_type] ?? Activity;
        return (
          <div key={a.id} className="flex gap-3 py-2.5 border-b border-border-color last:border-0">
            <div className="h-7 w-7 rounded-full bg-bg-secondary border border-border-color flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3.5 w-3.5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary leading-relaxed">{a.description ?? a.activity_type.replace(/_/g, ' ')}</p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                {a.user_name ? `${a.user_name} · ` : ''}{timeAgo(a.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({
  contactId, notes, loading,
  onAdd, onDelete,
}: {
  contactId: number;
  notes: ContactNote[];
  loading: boolean;
  onAdd: (content: string, category: string) => Promise<void>;
  onDelete: (noteId: number) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onAdd(content.trim(), category);
      setContent('');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="py-4 space-y-4">
      {/* Add note */}
      <div className="rounded-xl border border-border-color bg-bg-secondary p-3 space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full text-xs bg-transparent text-text-primary placeholder:text-text-secondary resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="text-xs bg-transparent text-text-secondary border border-border-color rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value="general">General</option>
            <option value="preference">Preference</option>
            <option value="complaint">Complaint</option>
            <option value="follow-up">Follow-up</option>
          </select>
          <button
            onClick={submit}
            disabled={saving || !content.trim()}
            className="px-3 py-1 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState icon={FileText} text="No notes yet" />
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="rounded-xl border border-border-color bg-bg-secondary p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      note.source === 'ai' ? 'bg-purple-500/10 text-purple-400' : 'bg-bg-secondary text-text-secondary border border-border-color'
                    }`}>
                      {note.source === 'ai' ? '🤖 AI' : note.category}
                    </span>
                    <span className="text-[10px] text-text-secondary">{timeAgo(note.created_at)}</span>
                    {note.user_name && <span className="text-[10px] text-text-secondary">· {note.user_name}</span>}
                  </div>
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>
                <button
                  onClick={() => onDelete(note.id)}
                  className="p-1 rounded hover:bg-card-bg text-text-secondary hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Channels Tab ──────────────────────────────────────────────────────────────

function ChannelsTab({ contactId }: { contactId: number }) {
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const { updateRouting } = useContactV2Store();

  useEffect(() => {
    setLoading(true);
    contactsV2Service.getChannels(contactId)
      .then(setChannels)
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) return <LoadingState />;
  if (channels.length === 0) return <EmptyState icon={Wifi} text="No active channels" />;

  const CHANNEL_ICONS: Record<string, string> = {
    whatsapp: '💬',
    instagram: '📸',
    messenger: '💙',
    sms: '📱',
    telegram: '✈️',
  };

  return (
    <div className="py-4 space-y-2">
      {channels.map(ch => (
        <div key={ch.channel_id} className="rounded-xl border border-border-color bg-bg-secondary p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{CHANNEL_ICONS[ch.channel_type] ?? '📡'}</span>
              <div>
                <p className="text-xs font-medium text-text-primary">{ch.channel_name}</p>
                <p className="text-[10px] text-text-secondary">{ch.channel_identifier}</p>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ROUTING_COLORS[ch.routing_mode ?? 'ai']}`}>
              {(ch.routing_mode ?? 'ai').toUpperCase()}
            </span>
          </div>
          <div className="flex gap-1">
            {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => updateRouting(contactId, mode)}
                className={`flex-1 py-1 text-[10px] rounded-lg border transition-colors ${
                  (ch.routing_mode ?? 'ai') === mode
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {mode === 'ai' ? 'AI' : mode === 'manual' ? 'Manual' : 'Block'}
              </button>
            ))}
          </div>
          {ch.agent_name && (
            <p className="text-[10px] text-text-secondary mt-1.5 flex items-center gap-1">
              <Bot className="h-2.5 w-2.5 text-accent" />
              Agent: {ch.agent_name}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pipeline Tab ──────────────────────────────────────────────────────────────

function PipelineTab({
  contactId, processes, loading, onMoveStage,
}: {
  contactId: number;
  processes: ContactProcessEntry[];
  loading: boolean;
  onMoveStage: (entryId: number, stageId: number) => Promise<void>;
}) {
  if (loading) return <LoadingState />;

  const active = processes.filter(p => p.status === 'active');
  const done = processes.filter(p => p.status !== 'active');

  if (processes.length === 0) return (
    <div className="py-4">
      <EmptyState icon={Layers} text="Not in any pipeline" subtext="Add this contact to a process to track their journey." />
    </div>
  );

  return (
    <div className="py-4 space-y-3">
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide font-semibold">Active ({active.length})</p>
          {active.map(entry => (
            <ProcessEntryCard key={entry.id} entry={entry} onMoveStage={stageId => onMoveStage(entry.id, stageId)} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-text-secondary uppercase tracking-wide font-semibold">Completed / Dropped ({done.length})</p>
          {done.map(entry => (
            <ProcessEntryCard key={entry.id} entry={entry} readonly />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessEntryCard({
  entry, onMoveStage, readonly = false,
}: {
  entry: ContactProcessEntry;
  onMoveStage?: (stageId: number) => Promise<void>;
  readonly?: boolean;
}) {
  const [moving, setMoving] = useState(false);

  async function move(stageId: number) {
    if (!onMoveStage || stageId === entry.current_stage_id) return;
    setMoving(true);
    try { await onMoveStage(stageId); } finally { setMoving(false); }
  }

  return (
    <div className="rounded-xl border border-border-color bg-bg-secondary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.process_color ?? '#6366f1' }}
          />
          <p className="text-xs font-medium text-text-primary">{entry.process_name}</p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          entry.status === 'active' ? 'bg-green-500/10 text-green-400'
          : entry.status === 'completed' ? 'bg-blue-500/10 text-blue-400'
          : 'bg-red-500/10 text-red-400'
        }`}>
          {entry.status}
        </span>
      </div>

      {entry.title && (
        <p className="text-xs text-text-secondary">{entry.title}</p>
      )}

      {/* Stage progress */}
      {entry.process_stages.length > 0 && !readonly && (
        <div className="flex gap-1 flex-wrap">
          {entry.process_stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => move(stage.id)}
              disabled={moving}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                stage.id === entry.current_stage_id
                  ? 'text-white border-transparent'
                  : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
              }`}
              style={stage.id === entry.current_stage_id ? { backgroundColor: stage.color ?? '#6366f1' } : {}}
            >
              {stage.id === entry.current_stage_id && moving ? '...' : stage.name}
            </button>
          ))}
        </div>
      )}

      {readonly && entry.current_stage_name && (
        <span
          className="inline-block text-[10px] px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: entry.current_stage_color ?? '#6366f1' }}
        >
          {entry.current_stage_name}
        </span>
      )}

      {/* Deal meta */}
      <div className="flex flex-wrap gap-3 text-[10px] text-text-secondary">
        {entry.expected_value != null && (
          <span className="flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            {entry.expected_value.toLocaleString('en-IN')}
          </span>
        )}
        {entry.expected_close_date && (
          <span className="flex items-center gap-0.5">
            <Calendar className="h-2.5 w-2.5" />
            {formatDate(entry.expected_close_date)}
          </span>
        )}
        {entry.entered_at && (
          <span>Entered {timeAgo(entry.entered_at)}</span>
        )}
      </div>
    </div>
  );
}

// ── Fields Tab ────────────────────────────────────────────────────────────────

function FieldsTab({ contact, contactId }: { contact: Contact; contactId: number }) {
  const { groups, loadGroups } = useContactV2Store();

  // All field defs applicable to this contact (global + all contact's groups)
  const [fieldDefs, setFieldDefs] = useState<ContactFieldDef[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);
  // Local working copy of values — keyed by field def id (string)
  const [values, setValues] = useState<Record<string, unknown>>({});
  // Which field is currently being edited
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  // Draft value while editing
  const [draft, setDraft] = useState<string>('');
  const [draftMulti, setDraftMulti] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);

  // Load group memberships then fetch all applicable field defs
  useEffect(() => {
    if (groups.length === 0) loadGroups();
  }, []);

  useEffect(() => {
    setValues(contact.custom_fields ?? {});
  }, [contact.custom_fields]);

  useEffect(() => {
    if (groups.length === 0) return;
    const fetchDefs = async () => {
      setLoadingDefs(true);
      try {
        // Fetch global fields + fields for every group this contact might be in
        // We load all and filter by contact's group memberships on the client
        const all = await listFieldDefs();
        // Determine which group IDs this contact belongs to
        const contactGroupIds = new Set<number>();
        for (const g of groups) {
          try {
            const detail = await contactGroupService.getDetail(g.id);
            if (detail.members.some((m: { id: number }) => m.id === contactId)) {
              contactGroupIds.add(g.id);
            }
          } catch { /* skip */ }
        }
        // Show global fields + fields belonging to contact's groups
        const applicable = all.filter(
          f => f.group_id === null || contactGroupIds.has(f.group_id)
        );
        setFieldDefs(applicable);
      } finally {
        setLoadingDefs(false);
      }
    };
    fetchDefs();
  }, [groups.length, contactId]);

  const startEdit = (f: ContactFieldDef) => {
    setEditingId(f.id);
    const current = values[String(f.id)];
    if (f.field_type === 'multi_select') {
      setDraftMulti(Array.isArray(current) ? (current as string[]) : []);
    } else if (f.field_type === 'boolean') {
      setDraft(current === true ? 'true' : 'false');
    } else {
      setDraft(current !== undefined && current !== null ? String(current) : '');
    }
    setTimeout(() => (inputRef.current as HTMLElement | null)?.focus(), 50);
  };

  const cancelEdit = () => { setEditingId(null); setDraft(''); setDraftMulti([]); };

  const saveEdit = async (f: ContactFieldDef) => {
    setSavingId(f.id);
    try {
      let val: unknown;
      if (f.field_type === 'multi_select') val = draftMulti;
      else if (f.field_type === 'boolean')  val = draft === 'true';
      else if (f.field_type === 'number')   val = draft === '' ? null : Number(draft);
      else                                   val = draft === '' ? null : draft;

      const key = String(f.id);
      const newValues = { ...values, [key]: val };
      await setContactCustomFields(contactId, { [key]: val });
      setValues(newValues);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────

  function renderValue(f: ContactFieldDef) {
    const v = values[String(f.id)];
    if (v === undefined || v === null || v === '') {
      return <span className="text-text-secondary/40 italic text-xs">Not set</span>;
    }
    if (f.field_type === 'boolean') {
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          v === true ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-500'
        }`}>
          {v === true ? 'Yes' : 'No'}
        </span>
      );
    }
    if (f.field_type === 'multi_select') {
      const arr = Array.isArray(v) ? v as string[] : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map(item => (
            <span key={item} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded-full">{item}</span>
          ))}
        </div>
      );
    }
    if (f.field_type === 'url') {
      return (
        <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline truncate block max-w-[200px]">
          {String(v)}
        </a>
      );
    }
    if (f.field_type === 'date') {
      return <span className="text-xs text-text-primary">{fmtDate(String(v))}</span>;
    }
    return <span className="text-xs text-text-primary break-words">{String(v)}</span>;
  }

  function renderEditor(f: ContactFieldDef) {
    const cls = "w-full px-2.5 py-1.5 text-xs border border-accent rounded-lg bg-card-bg text-text-primary focus:outline-none";

    if (f.field_type === 'boolean') {
      return (
        <div className="flex gap-2">
          {['true', 'false'].map(opt => (
            <button
              key={opt}
              onClick={() => setDraft(opt)}
              className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                draft === opt
                  ? opt === 'true' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                  : 'border-border-color text-text-secondary hover:border-accent'
              }`}
            >
              {opt === 'true' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );
    }

    if (f.field_type === 'select') {
      return (
        <select value={draft} onChange={e => setDraft(e.target.value)} className={cls}>
          <option value="">— select —</option>
          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (f.field_type === 'multi_select') {
      return (
        <div className="flex flex-wrap gap-1">
          {(f.options ?? []).map(o => {
            const selected = draftMulti.includes(o);
            return (
              <button
                key={o}
                onClick={() => setDraftMulti(prev =>
                  selected ? prev.filter(x => x !== o) : [...prev, o]
                )}
                className={`px-2 py-1 text-[11px] rounded-full border transition-all ${
                  selected ? 'bg-accent text-white border-accent' : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }

    if (f.field_type === 'textarea') {
      return (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className={cls + ' resize-none'}
        />
      );
    }

    return (
      <input
        ref={inputRef}
        type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : f.field_type === 'email' ? 'email' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') saveEdit(f); if (e.key === 'Escape') cancelEdit(); }}
        className={cls}
      />
    );
  }

  if (loadingDefs) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
    </div>
  );

  // Group field defs by their group (or "Global")
  const globalFields  = fieldDefs.filter(f => f.group_id === null);
  const groupedFields = fieldDefs.filter(f => f.group_id !== null);
  const byGroup = groupedFields.reduce<Record<string, { name: string; fields: ContactFieldDef[] }>>((acc, f) => {
    const key = String(f.group_id);
    if (!acc[key]) acc[key] = { name: f.group_name ?? `Group ${f.group_id}`, fields: [] };
    acc[key].fields.push(f);
    return acc;
  }, {});

  const allSections: Array<{ label: string; isSystem?: boolean; fields: ContactFieldDef[] }> = [];
  if (globalFields.length > 0) allSections.push({ label: 'Global Fields', fields: globalFields });
  Object.values(byGroup).forEach(g => allSections.push({ label: g.name, fields: g.fields }));

  if (allSections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <LayoutList className="h-10 w-10 text-text-secondary/20" />
        <p className="text-sm text-text-secondary">No custom fields defined yet.</p>
        <p className="text-xs text-text-secondary/60 max-w-[220px]">
          Open the Group Settings panel and go to <strong>Custom Fields</strong> in any group to add fields.
        </p>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-6">
      {allSections.map(section => (
        <div key={section.label}>
          <p className="text-[10px] font-semibold text-text-secondary/60 uppercase tracking-wider mb-2">
            {section.label}
          </p>
          <div className="space-y-px rounded-xl border border-border-color overflow-hidden">
            {section.fields.map((f, idx) => {
              const isEditing = editingId === f.id;
              const isSaving  = savingId === f.id;
              const isLast    = idx === section.fields.length - 1;

              return (
                <div
                  key={f.id}
                  className={`flex gap-3 px-3 py-2.5 bg-card-bg hover:bg-bg-secondary/40 transition-colors group ${!isLast ? 'border-b border-border-color/60' : ''}`}
                >
                  {/* Label column */}
                  <div className="w-[120px] flex-shrink-0 pt-0.5">
                    <p className="text-[11px] font-medium text-text-secondary truncate">{f.name}</p>
                    {f.required && <span className="text-[9px] text-red-400">required</span>}
                  </div>

                  {/* Value / editor column */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        {renderEditor(f)}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(f)}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60"
                          >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-[11px] text-text-secondary border border-border-color rounded-lg hover:bg-bg-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => startEdit(f)}
                        title="Click to edit"
                      >
                        <div className="flex-1 min-w-0">{renderValue(f)}</div>
                        <Edit2 className="w-3 h-3 text-text-secondary/0 group-hover:text-text-secondary/60 flex-shrink-0 transition-colors" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
    </div>
  );
}

function EmptyState({ icon: Icon, text, subtext }: { icon: React.ElementType; text: string; subtext?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon className="h-8 w-8 text-text-secondary/40" />
      <p className="text-sm text-text-secondary">{text}</p>
      {subtext && <p className="text-xs text-text-secondary/60 max-w-[200px]">{subtext}</p>}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ContactDetailPanel({ contactId, onClose, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const {
    selectedContact: contact, loadingDetail,
    activities, notes, processes,
    loadingActivities, loadingNotes, loadingProcesses,
    select, loadActivities, loadNotes, loadProcesses,
    addNote, deleteNote, moveProcessStage,
  } = useContactV2Store();

  // Load contact + tab data
  useEffect(() => {
    select(contactId);
  }, [contactId]);

  useEffect(() => {
    if (!contact) return;
    if (activeTab === 'activity' && activities.length === 0) loadActivities(contactId);
    if (activeTab === 'notes' && notes.length === 0) loadNotes(contactId);
    if (activeTab === 'pipeline' && processes.length === 0) loadProcesses(contactId);
  }, [activeTab, contact]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-[420px] border-l border-border-color bg-card-bg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-color shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {loadingDetail ? (
              <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
                {(contact?.name ?? contact?.phone ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <p className="text-sm font-semibold text-text-primary truncate">
              {contact?.name ?? contact?.phone ?? 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {contact && (
              <button
                onClick={() => onEdit(contact)}
                className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
                title="Edit contact"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-color shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5">
          {!contact && !loadingDetail ? (
            <EmptyState icon={User} text="Contact not found" />
          ) : contact ? (
            <>
              {activeTab === 'overview' && <OverviewTab contact={contact} onEdit={() => onEdit(contact)} contactId={contactId} />}
              {activeTab === 'fields' && <FieldsTab contact={contact} contactId={contactId} />}
              {activeTab === 'activity' && <ActivityTab activities={activities} loading={loadingActivities} />}
              {activeTab === 'notes' && (
                <NotesTab
                  contactId={contactId}
                  notes={notes}
                  loading={loadingNotes}
                  onAdd={(content, category) => addNote(contactId, content, category)}
                  onDelete={noteId => deleteNote(contactId, noteId)}
                />
              )}
              {activeTab === 'channels' && <ChannelsTab contactId={contactId} />}
              {activeTab === 'pipeline' && (
                <PipelineTab
                  contactId={contactId}
                  processes={processes}
                  loading={loadingProcesses}
                  onMoveStage={(entryId, stageId) => moveProcessStage(contactId, entryId, stageId)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
