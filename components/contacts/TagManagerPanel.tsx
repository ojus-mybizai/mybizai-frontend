'use client';

/**
 * TagManagerPanel — Create, rename, recolour, and delete contact tags.
 *
 * Supports two scopes:
 *   Global tags  (group_id = null)  — shown in all contexts
 *   Group tags   (group_id = X)     — shown only when inside that group
 *
 * Props:
 *   groupId   — if provided, shows that group's scoped tags alongside global ones
 *               and lets the user create tags scoped to that group
 *   onClose   — close callback (used when rendered as an overlay/drawer)
 */

import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Check, X, Globe, Layers } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import type { ContactTag } from '@/services/contacts-v2';

/* ── Colour swatches ──────────────────────────────────────────────────────── */
const SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#64748b', '#1e293b',
];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
      style={{ backgroundColor: color, borderColor: selected ? '#fff' : 'transparent', outline: selected ? `2px solid ${color}` : 'none' }}
      title={color}
    >
      {selected && <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />}
    </button>
  );
}

/* ── Single tag row (view + inline edit) ──────────────────────────────────── */
function TagRow({
  tag,
  onRename,
  onDelete,
}: {
  tag: ContactTag;
  onRename: (name: string, color: string) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName]     = useState(tag.name);
  const [color, setColor]   = useState(tag.color ?? '#6366f1');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setName(tag.name);
    setColor(tag.color ?? '#6366f1');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onRename(name.trim(), color);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setEditing(false);
    setName(tag.name);
    setColor(tag.color ?? '#6366f1');
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl border border-accent/40 bg-accent/5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') cancel(); }}
            className="flex-1 text-sm bg-transparent border-b border-border-color focus:border-accent outline-none text-text-primary py-0.5"
          />
          <button type="button" onClick={save} disabled={saving || !name.trim()}
            className="p-1 rounded text-accent hover:bg-accent/10 disabled:opacity-40">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={cancel}
            className="p-1 rounded text-text-secondary hover:bg-bg-secondary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-5">
          {SWATCHES.map(s => (
            <ColorSwatch key={s} color={s} selected={color === s} onClick={() => setColor(s)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-bg-secondary transition-colors">
      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color ?? '#6366f1' }} />
      <span className="flex-1 text-sm text-text-primary truncate">{tag.name}</span>
      {tag.group_id == null
        ? <Globe className="h-3 w-3 text-text-secondary opacity-50" aria-label="Global tag" />
        : <Layers className="h-3 w-3 text-accent opacity-70" aria-label="Group tag" />}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={startEdit}
          className="p-1 rounded text-text-secondary hover:text-accent hover:bg-bg-secondary transition-colors" title="Rename / recolour">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete}
          className="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" title="Delete tag">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Create form ─────────────────────────────────────────────────────────── */
function CreateTagForm({
  groupId,
  onCreated,
}: {
  groupId?: number | null;
  onCreated: () => void;
}) {
  const { createTag } = useContactV2Store();
  const [name, setName]     = useState('');
  const [color, setColor]   = useState(SWATCHES[0]);
  const [scope, setScope]   = useState<'global' | 'group'>(groupId != null ? 'group' : 'global');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Tag name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createTag({
        name: name.trim(),
        color,
        group_id: (scope === 'group' && groupId != null) ? groupId : null,
      });
      setName('');
      setColor(SWATCHES[0]);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 px-3 py-3 border border-border-color rounded-xl bg-bg-primary">
      {/* Name */}
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          placeholder="Tag name…"
          className="flex-1 text-sm bg-transparent border-b border-border-color focus:border-accent outline-none text-text-primary py-0.5 placeholder:text-text-secondary"
          autoFocus
        />
      </div>

      {/* Colour swatches */}
      <div className="flex flex-wrap gap-1.5 pl-5">
        {SWATCHES.map(s => (
          <ColorSwatch key={s} color={s} selected={color === s} onClick={() => setColor(s)} />
        ))}
      </div>

      {/* Scope toggle — only shown when inside a group */}
      {groupId != null && (
        <div className="flex gap-2 pl-5">
          {(['global', 'group'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all
                ${scope === s ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border-color text-text-secondary hover:border-accent/50'}`}
            >
              {s === 'global' ? <Globe className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
              {s === 'global' ? 'Global (all groups)' : 'This group only'}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 pl-5">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={() => { setName(''); setError(''); onCreated(); }}
          className="px-3 py-1.5 text-xs border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving || !name.trim()}
          className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? 'Creating…' : 'Create tag'}
        </button>
      </div>
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */

interface Props {
  /** When inside a group view, pass the group ID to show/create group-scoped tags */
  groupId?: number | null;
  groupName?: string;
  onClose?: () => void;
}

export function TagManagerPanel({ groupId, groupName, onClose }: Props) {
  const { tags, loadTags, updateTag, deleteTag } = useContactV2Store();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void loadTags(groupId);
  }, [groupId]);

  const globalTags = tags.filter(t => t.group_id == null);
  const groupTags  = tags.filter(t => t.group_id != null);

  const handleDelete = async (tag: ContactTag) => {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all contacts.`)) return;
    setDeletingId(tag.id);
    try { await deleteTag(tag.id); } finally { setDeletingId(null); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Tags</h2>
          <p className="text-[11px] text-text-secondary mt-0.5">
            {groupId != null
              ? `Global tags + tags scoped to "${groupName ?? 'this group'}"`
              : 'Global tags — visible across all contacts'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            New tag
          </button>
          {onClose && (
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-md text-text-secondary hover:bg-bg-secondary transition-colors ml-1">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Create form */}
        {showCreate && (
          <CreateTagForm
            groupId={groupId}
            onCreated={() => setShowCreate(false)}
          />
        )}

        {/* Group-scoped tags (only shown when inside a group) */}
        {groupId != null && (
          <div>
            <div className="flex items-center gap-1.5 px-1 mb-1">
              <Layers className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                {groupName ?? 'Group'} tags
              </span>
              <span className="text-[10px] text-text-secondary">({groupTags.length})</span>
            </div>
            {groupTags.length === 0 ? (
              <p className="text-xs text-text-secondary italic px-3 py-2">
                No tags scoped to this group yet.
              </p>
            ) : (
              <div className="space-y-0.5">
                {groupTags.map(tag => (
                  <div key={tag.id} className={deletingId === tag.id ? 'opacity-40 pointer-events-none' : ''}>
                    <TagRow
                      tag={tag}
                      onRename={(name, color) => updateTag(tag.id, { name, color })}
                      onDelete={() => void handleDelete(tag)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global tags */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-1">
            <Globe className="h-3 w-3 text-text-secondary" />
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
              Global tags
            </span>
            <span className="text-[10px] text-text-secondary">({globalTags.length})</span>
          </div>
          {globalTags.length === 0 ? (
            <p className="text-xs text-text-secondary italic px-3 py-2">
              No global tags yet. Create one above.
            </p>
          ) : (
            <div className="space-y-0.5">
              {globalTags.map(tag => (
                <div key={tag.id} className={deletingId === tag.id ? 'opacity-40 pointer-events-none' : ''}>
                  <TagRow
                    tag={tag}
                    onRename={(name, color) => updateTag(tag.id, { name, color })}
                    onDelete={() => void handleDelete(tag)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {tags.length === 0 && !showCreate && (
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">No tags yet</p>
            <p className="text-xs text-text-secondary mt-1">Create your first tag to start categorising contacts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
