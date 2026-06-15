'use client';

import { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, Bot, UserCheck, UserX, Loader2,
  Settings, Users, Zap, ChevronDown, ChevronUp, Edit2, Check, Lock,
  Wifi, MessageSquare, Instagram, Send, LayoutList, GripVertical,
  Type, Hash, Calendar, ToggleLeft, Link, Phone, Mail, AlignLeft,
} from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import { contactGroupService, type ContactGroup, type ContactGroupDetail } from '@/services/contacts-v2';
import { listChannels, type Channel } from '@/services/channels';
import { listAgents, type Agent } from '@/services/agents';
import {
  listFieldDefs, createFieldDef, updateFieldDef, deleteFieldDef,
  type ContactFieldDef, type FieldType, FIELD_TYPE_LABELS,
} from '@/services/contact-field-defs';
import IntakeRoutingSection from './intake-routing-section';

interface Props {
  onClose: () => void;
  onGroupSelect?: (groupId: number | null) => void;
  activeGroupId?: number | null;
}

const ROUTING_OPTIONS = [
  { value: 'ai',      label: 'AI Auto',  icon: Bot,        cls: 'text-green-700 bg-green-50 border-green-300' },
  { value: 'manual',  label: 'Manual',   icon: UserCheck,  cls: 'text-amber-700 bg-amber-50 border-amber-300' },
  { value: 'blocked', label: 'Blocked',  icon: UserX,      cls: 'text-red-600 bg-red-50 border-red-300' },
];

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#64748b',
];

function channelIcon(type: string) {
  switch (type) {
    case 'whatsapp':  return <MessageSquare className="w-3.5 h-3.5 text-green-500" />;
    case 'instagram': return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
    case 'telegram':  return <Send className="w-3.5 h-3.5 text-blue-400" />;
    default:          return <Wifi className="w-3.5 h-3.5 text-text-secondary" />;
  }
}

function channelTypeBadge(type: string) {
  const map: Record<string, string> = {
    whatsapp: 'bg-green-50 text-green-700 border-green-200',
    instagram: 'bg-pink-50 text-pink-700 border-pink-200',
    telegram: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return map[type] ?? 'bg-bg-secondary text-text-secondary border-border-color';
}

// ── Main panel ──────────────────────────────────────────────────

export function GroupRoutingPanel({ onClose, onGroupSelect, activeGroupId }: Props) {
  const { groups: _groups, loadingGroups, loadGroups, createGroup, updateGroup, deleteGroup } = useContactV2Store();
  const groups = [..._groups].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ContactGroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [applyingKey, setApplyingKey] = useState<string | null>(null); // `${groupId}-${channelId}`
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load groups, channels, and agents once
  useEffect(() => {
    if (groups.length === 0) loadGroups();
    listChannels().then(setChannels).catch(() => {});
    listAgents().then(setAgents).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createGroup({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleExpand = async (groupId: number) => {
    if (expandedId === groupId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(groupId);
    setLoadingDetail(true);
    try {
      const d = await contactGroupService.getDetail(groupId);
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshDetail = async (groupId: number) => {
    const d = await contactGroupService.getDetail(groupId);
    setDetail(d);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateGroup(id, { name: editName.trim() });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // Save rule on group AND bulk-apply to all members in one shot
  const handleApplyRouting = async (groupId: number, channelId: number, mode: string, agentId: number | null) => {
    const key = `${groupId}-${channelId}`;
    setApplyingKey(key);
    try {
      const result = await contactGroupService.applyRouting(groupId, { channel_id: channelId, routing_mode: mode, agent_id: agentId });
      await refreshDetail(groupId);
      setSuccessMsg(`Routing applied to ${result.updated} contact${result.updated !== 1 ? 's' : ''}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setApplyingKey(null);
    }
  };

  // Save rule on group WITHOUT applying to members (preview / intent only)
  const handleSetRule = async (groupId: number, channelId: number, mode: string, agentId: number | null) => {
    await contactGroupService.setChannelRouting(groupId, channelId, { routing_mode: mode, agent_id: agentId });
    await refreshDetail(groupId);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[500px] bg-card-bg border-l border-border-color shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-color flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Contact Groups</h2>
            <p className="text-xs text-text-secondary">
              {groups.filter(g => g.is_system).length} auto · {groups.filter(g => !g.is_system).length} custom
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(o => !o)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Group
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-5 py-4 border-b border-border-color bg-bg-secondary/40 flex-shrink-0">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">New Group</p>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Group name…"
            className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-card-bg text-text-primary focus:outline-none focus:border-accent mb-3"
          />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-text-secondary">Color:</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? 'border-text-primary scale-110' : 'border-transparent scale-90'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex-1 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60 flex items-center justify-center gap-1"
            >
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="px-4 py-2 text-sm text-text-secondary border border-border-color rounded-lg hover:bg-bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-green-50 border-b border-green-200 text-xs text-green-700">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {/* Intake routing config — sits above the group list so owners
            configuring groups can also configure where new contacts land. */}
        <IntakeRoutingSection allGroups={groups} />

        {loadingGroups && groups.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-text-secondary">
            <Users className="w-8 h-8 opacity-20" />
            <p className="text-sm">No groups yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-color">
            {onGroupSelect && (
              <button
                onClick={() => onGroupSelect(null)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-bg-secondary/50 ${activeGroupId === null ? 'bg-accent/5' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-text-secondary" />
                </div>
                <span className={`text-sm font-medium ${activeGroupId === null ? 'text-accent' : 'text-text-primary'}`}>All Contacts</span>
              </button>
            )}

            {groups.map(group => (
              <GroupRow
                key={group.id}
                group={group}
                channels={channels}
                agents={agents}
                active={activeGroupId === group.id}
                expanded={expandedId === group.id}
                detail={expandedId === group.id ? detail : null}
                loadingDetail={expandedId === group.id && loadingDetail}
                editing={editingId === group.id}
                editName={editName}
                savingEdit={savingEdit}
                applyingKey={applyingKey}
                onSelect={() => onGroupSelect?.(activeGroupId === group.id ? null : group.id)}
                onExpand={() => handleExpand(group.id)}
                onStartEdit={() => { setEditingId(group.id); setEditName(group.name); }}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => handleSaveEdit(group.id)}
                onEditNameChange={setEditName}
                onDelete={() => deleteGroup(group.id)}
                onSetRule={(channelId, mode, agentId) => handleSetRule(group.id, channelId, mode, agentId)}
                onApplyRouting={(channelId, mode, agentId) => handleApplyRouting(group.id, channelId, mode, agentId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── GroupRow ────────────────────────────────────────────────────

interface GroupRowProps {
  group: ContactGroup;
  channels: Channel[];
  agents: Agent[];
  active: boolean;
  expanded: boolean;
  detail: ContactGroupDetail | null;
  loadingDetail: boolean;
  editing: boolean;
  editName: string;
  savingEdit: boolean;
  applyingKey: string | null;
  onSelect: () => void;
  onExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (v: string) => void;
  onDelete: () => void;
  onSetRule: (channelId: number, mode: string, agentId: number | null) => void;
  onApplyRouting: (channelId: number, mode: string, agentId: number | null) => void;
}

function GroupRow({
  group, channels, agents, active, expanded, detail, loadingDetail,
  editing, editName, savingEdit, applyingKey,
  onSelect, onExpand, onStartEdit, onCancelEdit, onSaveEdit, onEditNameChange,
  onDelete, onSetRule, onApplyRouting,
}: GroupRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedTab, setExpandedTab] = useState<'routing' | 'fields' | 'members'>('routing');

  // Build a map of channelId → { routing_mode, agent_id } from saved rules
  const ruleMap: Record<number, { mode: string; agentId: number | null }> = {};
  if (detail) {
    for (const r of detail.channel_routings) {
      ruleMap[r.channel_id] = { mode: r.routing_mode, agentId: r.agent_id };
    }
  }

  return (
    <div className={`transition-colors ${active ? 'bg-accent/5' : ''}`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
            style={{ backgroundColor: group.color ?? '#6366f1' }}
          >
            {group.name[0]?.toUpperCase()}
          </div>
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={editName}
                onChange={e => onEditNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
                className="flex-1 px-2 py-1 text-sm border border-accent rounded-md bg-card-bg text-text-primary focus:outline-none"
              />
              <button onClick={onSaveEdit} disabled={savingEdit} className="p-1 text-green-600 hover:text-green-700">
                {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={onCancelEdit} className="p-1 text-text-secondary hover:text-text-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-medium truncate ${active ? 'text-accent' : 'text-text-primary'}`}>{group.name}</p>
                {group.is_system && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-bg-secondary text-text-secondary border border-border-color flex-shrink-0">
                    <Lock className="w-2.5 h-2.5" /> Auto
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary">{group.member_count} members</p>
            </div>
          )}
        </button>

        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onStartEdit(); }}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              title="Rename"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {!group.is_system && (confirmDelete ? (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="px-2 py-1 text-xs border border-border-color rounded-md text-text-secondary hover:bg-bg-secondary"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                className="p-1.5 rounded-md text-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ))}
            <button
              onClick={e => { e.stopPropagation(); onExpand(); }}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
              title="Channel routing settings"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Expanded: tabs ──────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border-color bg-bg-secondary/30">
          {/* Tab bar */}
          <div className="flex border-b border-border-color px-5">
            {(['routing', 'fields', 'members'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setExpandedTab(tab)}
                className={`px-3 py-2.5 text-[11px] font-semibold border-b-2 -mb-px transition-colors capitalize ${
                  expandedTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab === 'routing' ? 'Routing' : tab === 'fields' ? 'Custom Fields' : 'Members'}
              </button>
            ))}
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            </div>
          ) : (
            <div className="px-5 pt-4 pb-5">

              {/* ── Routing tab ── */}
              {expandedTab === 'routing' && (
                <div>
                  <p className="text-[11px] text-text-secondary/70 mb-3">
                    Choose how contacts in this group are handled per channel. Click a mode to stage it, then
                    <strong className="text-text-secondary"> Apply</strong> to update all {group.member_count} members.
                  </p>
                  {channels.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-text-secondary/60 italic">
                      <Wifi className="w-4 h-4" />
                      No channels connected to this business yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {channels.map(ch => {
                        const channelId = Number(ch.id);
                        const saved = ruleMap[channelId] ?? null;
                        const applyKey = `${group.id}-${channelId}`;
                        const isApplying = applyingKey === applyKey;
                        return (
                          <ChannelRoutingRow
                            key={ch.id}
                            channel={ch}
                            agents={agents}
                            savedMode={saved?.mode ?? null}
                            savedAgentId={saved?.agentId ?? null}
                            isApplying={isApplying}
                            memberCount={group.member_count}
                            onSetRule={(mode, agentId) => onSetRule(channelId, mode, agentId)}
                            onApply={(mode, agentId) => onApplyRouting(channelId, mode, agentId)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Custom Fields tab ── */}
              {expandedTab === 'fields' && (
                <FieldDefsTab groupId={group.id} groupName={group.name} />
              )}

              {/* ── Members tab ── */}
              {expandedTab === 'members' && detail && (
                <div>
                  {detail.members.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-text-secondary/60 italic">
                      <Users className="w-3.5 h-3.5" />
                      No contacts in this group yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.members.slice(0, 20).map(m => (
                        <span
                          key={m.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-card-bg border border-border-color text-text-primary"
                        >
                          {m.name ?? m.phone ?? `#${m.id}`}
                        </span>
                      ))}
                      {detail.members.length > 20 && (
                        <span className="text-[10px] text-text-secondary self-center">+{detail.members.length - 20} more</span>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── FieldDefsTab ────────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<FieldType, React.ElementType> = {
  text: Type, textarea: AlignLeft, number: Hash, date: Calendar,
  boolean: ToggleLeft, select: ChevronDown, multi_select: LayoutList,
  url: Link, phone: Phone, email: Mail,
};

interface FieldDefsTabProps {
  groupId: number | null;   // null = business-wide (global) fields
  groupName: string;
}

export function FieldDefsTab({ groupId, groupName }: FieldDefsTabProps) {
  const [fields, setFields] = useState<ContactFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editOptions, setEditOptions] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    // null → global only (group_id=0); a group id → that group's scoped fields
    listFieldDefs(groupId == null ? 0 : groupId).then(setFields).finally(() => setLoading(false));
  }, [groupId]);

  const needsOptions = (t: FieldType) => t === 'select' || t === 'multi_select';
  const parseOptions = (raw: string) => raw.split(',').map(s => s.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (needsOptions(newType) && !newOptions.trim()) return;
    setCreating(true);
    try {
      const f = await createFieldDef({
        name: newName.trim(),
        field_type: newType,
        group_id: groupId,
        options: needsOptions(newType) ? parseOptions(newOptions) : null,
        required: newRequired,
        sort_order: fields.length,
      });
      setFields(prev => [...prev, f]);
      setNewName(''); setNewType('text'); setNewOptions(''); setNewRequired(false);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (f: ContactFieldDef) => {
    setSavingId(f.id);
    try {
      const updated = await updateFieldDef(f.id, {
        name: editName.trim() || f.name,
        options: needsOptions(f.field_type) ? parseOptions(editOptions) : f.options,
      });
      setFields(prev => prev.map(x => x.id === f.id ? updated : x));
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteFieldDef(id);
      setFields(prev => prev.filter(f => f.id !== id));
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-secondary/70">
          Custom fields for all contacts in <strong className="text-text-secondary">{groupName}</strong>.
          Values are filled per-contact in the contact detail panel.
        </p>
        <button
          onClick={() => setShowCreate(o => !o)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-accent text-white rounded-lg hover:bg-accent/90 flex-shrink-0"
        >
          <Plus className="w-3 h-3" /> Add Field
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-accent uppercase tracking-wide">New Field</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Field name…"
              className="flex-1 px-2.5 py-1.5 text-xs border border-border-color rounded-lg bg-card-bg text-text-primary focus:outline-none focus:border-accent"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as FieldType)}
              className="px-2.5 py-1.5 text-xs border border-border-color rounded-lg bg-card-bg text-text-primary focus:outline-none focus:border-accent"
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {needsOptions(newType) && (
            <input
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              placeholder="Options (comma-separated): Option A, Option B…"
              className="w-full px-2.5 py-1.5 text-xs border border-border-color rounded-lg bg-card-bg text-text-primary focus:outline-none focus:border-accent"
            />
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={e => setNewRequired(e.target.checked)}
                className="rounded"
              />
              Required
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setNewType('text'); }}
                className="px-3 py-1.5 text-[11px] text-text-secondary border border-border-color rounded-lg hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || (needsOptions(newType) && !newOptions.trim())}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field list */}
      {fields.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-text-secondary/50">
          <LayoutList className="w-6 h-6" />
          <p className="text-xs">No custom fields yet. Add one to capture specific data for this group.</p>
        </div>
      )}

      <div className="space-y-1.5">
        {fields.map(f => {
          const Icon = FIELD_TYPE_ICONS[f.field_type] ?? Type;
          const isEditing = editingId === f.id;
          const isSaving = savingId === f.id;
          const isDeleting = deletingId === f.id;
          const confirmDel = confirmDeleteId === f.id;

          return (
            <div
              key={f.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border-color bg-card-bg group"
            >
              <Icon className="w-3.5 h-3.5 text-text-secondary/60 flex-shrink-0" />

              {isEditing ? (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(f); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 px-2 py-1 text-xs border border-accent rounded-md bg-card-bg text-text-primary focus:outline-none"
                  />
                  {needsOptions(f.field_type) && (
                    <input
                      value={editOptions}
                      onChange={e => setEditOptions(e.target.value)}
                      placeholder="Options…"
                      className="flex-1 px-2 py-1 text-xs border border-border-color rounded-md bg-card-bg text-text-primary focus:outline-none focus:border-accent"
                    />
                  )}
                  <button onClick={() => handleSaveEdit(f)} disabled={isSaving} className="p-1 text-green-600 hover:text-green-700 flex-shrink-0">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-text-secondary flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-text-primary truncate">{f.name}</span>
                      {f.required && <span className="text-[9px] px-1 py-px bg-red-50 text-red-500 border border-red-200 rounded font-semibold">req</span>}
                    </div>
                    <span className="text-[10px] text-text-secondary/60">{FIELD_TYPE_LABELS[f.field_type]}</span>
                    {f.options && f.options.length > 0 && (
                      <span className="text-[10px] text-text-secondary/50 ml-1">· {f.options.slice(0, 3).join(', ')}{f.options.length > 3 ? `… +${f.options.length - 3}` : ''}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(f.id); setEditName(f.name); setEditOptions((f.options ?? []).join(', ')); }}
                      className="p-1 text-text-secondary hover:text-text-primary rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {confirmDel ? (
                      <>
                        <button onClick={() => handleDelete(f.id)} disabled={isDeleting} className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-60">
                          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 text-[10px] border border-border-color rounded text-text-secondary hover:bg-bg-secondary">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(f.id)} className="p-1 text-text-secondary hover:text-red-500 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ChannelRoutingRow ───────────────────────────────────────────

interface ChannelRoutingRowProps {
  channel: Channel;
  agents: Agent[];
  savedMode: string | null;
  savedAgentId: number | null;
  isApplying: boolean;
  memberCount: number;
  onSetRule: (mode: string, agentId: number | null) => void;
  onApply: (mode: string, agentId: number | null) => void;
}

function ChannelRoutingRow({
  channel, agents, savedMode, savedAgentId, isApplying, memberCount, onSetRule, onApply,
}: ChannelRoutingRowProps) {
  const [pendingMode, setPendingMode] = useState<string | null>(savedMode);
  const [pendingAgentId, setPendingAgentId] = useState<number | null>(savedAgentId);

  // Sync when parent refreshes saved state after apply/set
  useEffect(() => { setPendingMode(savedMode); }, [savedMode]);
  useEffect(() => { setPendingAgentId(savedAgentId); }, [savedAgentId]);

  const isDirty = pendingMode !== savedMode || pendingAgentId !== savedAgentId;
  const hasMode = pendingMode !== null;

  // Channel's default agent (may be null)
  const channelDefaultAgent = agents.find(a => a.id === String(channel.agentId)) ?? null;

  const handleSelectMode = (mode: string) => {
    const nextAgentId = mode === 'ai' ? pendingAgentId : null;
    setPendingMode(mode);
    if (mode !== 'ai') setPendingAgentId(null);
    onSetRule(mode, nextAgentId);
  };

  const handleSelectAgent = (agentId: number | null) => {
    setPendingAgentId(agentId);
    if (pendingMode) onSetRule(pendingMode, agentId);
  };

  const effectiveAgentId = pendingMode === 'ai' ? pendingAgentId : null;

  // Label shown in header for saved rule
  const savedLabel = (() => {
    if (!savedMode) return null;
    if (savedMode !== 'ai') return savedMode;
    if (savedAgentId) {
      const a = agents.find(ag => ag.id === String(savedAgentId));
      return a ? `AI · ${a.name}` : 'AI · agent';
    }
    return channelDefaultAgent ? `AI · ${channelDefaultAgent.name} (default)` : 'AI Auto';
  })();

  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-color/60">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-bg-secondary flex-shrink-0">
          {channelIcon(channel.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary truncate">{channel.name}</p>
          <span className={`inline-block text-[10px] px-1.5 py-px rounded border font-medium ${channelTypeBadge(channel.type)}`}>
            {channel.type}
          </span>
        </div>
        {savedLabel ? (
          <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
            <Check className="w-3 h-3" /> {savedLabel}
          </span>
        ) : (
          <span className="text-[10px] text-text-secondary/50 italic">Not configured</span>
        )}
      </div>

      {/* Routing mode picker */}
      <div className="px-3 pt-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-text-secondary font-medium mr-1">Route:</span>
        {ROUTING_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isActive = pendingMode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelectMode(opt.value)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                isActive
                  ? opt.cls + ' ring-1 ring-offset-0'
                  : 'border-border-color text-text-secondary hover:border-accent hover:text-accent bg-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Agent selector — shown only when AI Auto is selected */}
      {pendingMode === 'ai' && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <span className="text-[10px] text-text-secondary font-medium">Agent:</span>
            <div className="relative flex-1">
              <select
                value={effectiveAgentId ?? ''}
                onChange={e => handleSelectAgent(e.target.value ? Number(e.target.value) : null)}
                className="w-full appearance-none pl-2.5 pr-7 py-1.5 text-[11px] border border-border-color rounded-lg bg-card-bg text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">
                  {channelDefaultAgent
                    ? `Default — ${channelDefaultAgent.name}`
                    : 'Default AI Agent'}
                </option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary" />
            </div>
          </div>
          {!channelDefaultAgent && !effectiveAgentId && (
            <p className="text-[10px] text-amber-600 mt-1 pl-5">
              No default agent set for this channel — select a specific agent above.
            </p>
          )}
        </div>
      )}

      {/* Apply button row */}
      <div className="px-3 py-2.5 flex items-center justify-end gap-2">
        {isDirty && hasMode && (
          <span className="text-[10px] text-amber-600 flex items-center gap-1 flex-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            Apply to push to {memberCount} contact{memberCount !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={() => hasMode && onApply(pendingMode!, effectiveAgentId)}
          disabled={!hasMode || isApplying}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            hasMode
              ? isDirty
                ? 'bg-accent text-white hover:bg-accent/90 shadow-sm'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
              : 'bg-bg-secondary text-text-secondary/50 cursor-not-allowed'
          } disabled:opacity-60`}
          title={`Apply routing to all ${memberCount} contacts in this group via ${channel.name}`}
        >
          {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {isApplying ? 'Applying…' : `Apply to ${memberCount}`}
        </button>
      </div>
    </div>
  );
}
