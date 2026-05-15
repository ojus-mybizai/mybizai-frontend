'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import type {
  ConversationSavedView,
  ConversationSavedViewCreate,
  ConversationSavedViewUpdate,
} from '@/services/conversationViews';
import type { ContactGroup } from '@/services/contactGroups';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

const MODE_LABELS: Record<string, string> = {
  ai: 'AI',
  manual: 'Manual',
};

function viewSubtitle(view: ConversationSavedView): string {
  const parts: string[] = [];
  if (view.channel_type) parts.push(CHANNEL_LABELS[view.channel_type] ?? view.channel_type);
  if (view.mode) parts.push(MODE_LABELS[view.mode] ?? view.mode);
  if (view.contact_group_name) parts.push(`#${view.contact_group_name}`);
  if (view.unread_only) parts.push('Unread');
  if (view.intent) parts.push(`"${view.intent}"`);
  return parts.length ? parts.join(' · ') : 'All conversations';
}

// ── Create / Edit form ────────────────────────────────────────────────────────

interface ViewFormProps {
  initial?: Partial<ConversationSavedView>;
  contactGroups: ContactGroup[];
  onSave: (data: ConversationSavedViewCreate | ConversationSavedViewUpdate) => Promise<void>;
  onCancel: () => void;
  title: string;
}

function ViewForm({ initial, contactGroups, onSave, onCancel, title }: ViewFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [channelType, setChannelType] = useState(initial?.channel_type ?? '');
  const [mode, setMode] = useState(initial?.mode ?? '');
  const [contactGroupId, setContactGroupId] = useState<string>(
    initial?.contact_group_id ? String(initial.contact_group_id) : '',
  );
  const [unreadOnly, setUnreadOnly] = useState(initial?.unread_only ?? false);
  const [intent, setIntent] = useState(initial?.intent ?? '');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        emoji: emoji.trim() || null,
        channel_type: channelType || null,
        mode: mode || null,
        contact_group_id: contactGroupId ? Number(contactGroupId) : null,
        unread_only: unreadOnly,
        intent: intent.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-border-color rounded-lg bg-card-bg shadow-lg p-3 space-y-2.5 text-xs"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{title}</p>

      {/* Name + emoji */}
      <div className="flex gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="😀"
          maxLength={2}
          className="w-10 shrink-0 rounded-md border border-border-color bg-bg-primary px-1.5 py-1.5 text-center text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name…"
          required
          maxLength={100}
          className="flex-1 min-w-0 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Channel */}
      <select
        value={channelType}
        onChange={(e) => setChannelType(e.target.value)}
        className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All channels</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="messenger">Messenger</option>
      </select>

      {/* Mode */}
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">All modes</option>
        <option value="ai">AI</option>
        <option value="manual">Manual</option>
      </select>

      {/* Contact group */}
      {contactGroups.length > 0 && (
        <select
          value={contactGroupId}
          onChange={(e) => setContactGroupId(e.target.value)}
          className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Any contact group</option>
          {contactGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      {/* Intent / topic */}
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="Topic / intent keyword…"
        maxLength={200}
        className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {/* Unread only */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
          className="rounded border-border-color text-accent focus:ring-accent"
        />
        <span className="text-text-primary">Unread only</span>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface SavedViewsPanelProps {
  views: ConversationSavedView[];
  activeViewId: number | null;
  contactGroups: ContactGroup[];
  onSelect: (view: ConversationSavedView | null) => void;
  onCreate: (data: ConversationSavedViewCreate) => Promise<void>;
  onUpdate: (id: number, data: ConversationSavedViewUpdate) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function SavedViewsPanel({
  views,
  activeViewId,
  contactGroups,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: SavedViewsPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const handleCreate = async (data: ConversationSavedViewCreate | ConversationSavedViewUpdate) => {
    await onCreate(data as ConversationSavedViewCreate);
    setShowCreate(false);
  };

  const handleUpdate = async (data: ConversationSavedViewCreate | ConversationSavedViewUpdate) => {
    if (!editingId) return;
    await onUpdate(editingId, data as ConversationSavedViewUpdate);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    setMenuOpenId(null);
    await onDelete(id);
    // If we deleted the active view, clear it
    if (activeViewId === id) onSelect(null);
  };

  return (
    <div className="border-b border-border-color shrink-0">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary/70">
          Saved Views
        </span>
        <button
          type="button"
          onClick={() => { setShowCreate((v) => !v); setEditingId(null); }}
          title="Create new view"
          className="rounded p-0.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-2 pb-2">
          <ViewForm
            contactGroups={contactGroups}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            title="New view"
          />
        </div>
      )}

      {/* View chips */}
      {views.length === 0 && !showCreate ? (
        <p className="px-3 pb-2 text-[11px] text-text-secondary/60 italic">
          No views yet. Press + to create one.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {views.map((view) => {
            const isActive = view.id === activeViewId;
            const isEditing = view.id === editingId;

            if (isEditing) {
              return (
                <li key={view.id}>
                  <ViewForm
                    initial={view}
                    contactGroups={contactGroups}
                    onSave={handleUpdate}
                    onCancel={() => setEditingId(null)}
                    title="Edit view"
                  />
                </li>
              );
            }

            return (
              <li key={view.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(isActive ? null : view)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  {view.emoji ? (
                    <span className="shrink-0 text-sm leading-none">{view.emoji}</span>
                  ) : (
                    <span className="shrink-0 h-4 w-4 rounded bg-bg-secondary text-center text-[9px] leading-4 text-text-secondary font-bold">
                      {view.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate">{view.name}</span>
                      {isActive && <Check className="h-3 w-3 shrink-0" />}
                    </div>
                    <p className="truncate text-[10px] text-text-secondary font-normal">
                      {viewSubtitle(view)}
                    </p>
                  </div>
                </button>

                {/* Context menu trigger */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuOpenId === view.id ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === view.id ? null : view.id); }}
                    className="rounded p-0.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                    title="View options"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {menuOpenId === view.id && (
                    <div className="absolute right-0 top-full z-30 mt-0.5 w-32 rounded-lg border border-border-color bg-card-bg shadow-lg py-0.5">
                      <button
                        type="button"
                        onClick={() => { setEditingId(view.id); setMenuOpenId(null); setShowCreate(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(view.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
