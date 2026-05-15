'use client';

/**
 * TagPicker — inline dropdown for assigning / removing tags on a contact.
 *
 * Shows all tags available in the current context (global + optionally a
 * group's scoped tags). Ticking a tag assigns it; unticking removes it.
 * Includes a quick-create inline form at the bottom.
 *
 * Usage:
 *   <TagPicker
 *     contactId={contact.id}
 *     assignedTags={contact.tags}
 *     groupId={currentGroupId}   // optional — adds group tags to the list
 *     onChanged={refreshContact} // callback after assign/remove
 *   />
 */

import { useEffect, useRef, useState } from 'react';
import { Tag, Plus, Check, Loader2, X } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import { contactsV2Service, contactTagService } from '@/services/contacts-v2';
import type { ContactTag } from '@/services/contacts-v2';

interface Props {
  contactId: number;
  assignedTags: ContactTag[];
  groupId?: number | null;
  onChanged?: (tags: ContactTag[]) => void;
  /** Render as icon button (default) or as the tags pill row */
  trigger?: 'icon' | 'pills';
}

export function TagPicker({ contactId, assignedTags, groupId, onChanged, trigger = 'icon' }: Props) {
  const { tags: allTags, loadTags, createTag } = useContactV2Store();
  const [open, setOpen]         = useState(false);
  const [busy, setBusy]         = useState<Set<number>>(new Set());
  const [localTags, setLocal]   = useState<ContactTag[]>(assignedTags);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Load tags when opening
  useEffect(() => {
    if (open && allTags.length === 0) void loadTags(groupId);
  }, [open]);

  // Keep local in sync with prop
  useEffect(() => { setLocal(assignedTags); }, [assignedTags]);

  const assignedIds = new Set(localTags.map(t => t.id));

  const toggle = async (tag: ContactTag) => {
    setBusy(prev => new Set(prev).add(tag.id));
    try {
      if (assignedIds.has(tag.id)) {
        await contactsV2Service.removeTag(contactId, tag.id);
        const next = localTags.filter(t => t.id !== tag.id);
        setLocal(next);
        onChanged?.(next);
      } else {
        await contactsV2Service.addTag(contactId, tag.id);
        const next = [...localTags, tag];
        setLocal(next);
        onChanged?.(next);
      }
    } finally {
      setBusy(prev => { const s = new Set(prev); s.delete(tag.id); return s; });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const tag = await createTag({ name: newName.trim(), color: newColor, group_id: null });
      // Auto-assign the newly created tag
      await contactsV2Service.addTag(contactId, tag.id);
      const next = [...localTags, tag];
      setLocal(next);
      onChanged?.(next);
      setNewName('');
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const SWATCHES = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      {trigger === 'icon' ? (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 transition-all"
          title="Manage tags"
        >
          <Tag className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          className="flex flex-wrap items-center gap-1 min-h-[24px] max-w-[200px]"
          title="Click to manage tags"
        >
          {localTags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white"
              style={{ backgroundColor: tag.color ?? '#6366f1' }}
            >
              {tag.name}
            </span>
          ))}
          {localTags.length > 3 && (
            <span className="text-[10px] text-text-secondary">+{localTags.length - 3}</span>
          )}
          <Plus className="w-3 h-3 text-text-secondary opacity-60" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-56 bg-card-bg border border-border-color rounded-xl shadow-xl py-1.5 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Tag list */}
          <div className="max-h-52 overflow-y-auto">
            {allTags.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-secondary italic">No tags yet</p>
            ) : (
              allTags.map(tag => {
                const checked = assignedIds.has(tag.id);
                const loading = busy.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => void toggle(tag)}
                    disabled={loading}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors
                      ${checked ? 'bg-accent/5' : 'hover:bg-bg-secondary'}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color ?? '#6366f1' }}
                    />
                    <span className="flex-1 truncate text-text-primary">{tag.name}</span>
                    {loading
                      ? <Loader2 className="h-3 w-3 animate-spin text-text-secondary" />
                      : checked
                        ? <Check className="h-3 w-3 text-accent" />
                        : null
                    }
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border-color mt-1 pt-1">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                <Plus className="h-3 w-3" />
                Create new tag
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                  placeholder="Tag name…"
                  autoFocus
                  className="w-full text-xs border border-border-color rounded-md px-2 py-1 bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
                />
                <div className="flex gap-1 flex-wrap">
                  {SWATCHES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewColor(s)}
                      className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: s, borderColor: newColor === s ? '#fff' : 'transparent', outline: newColor === s ? `2px solid ${s}` : 'none' }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button type="button" onClick={() => { setCreating(false); setNewName(''); }}
                    className="px-2 py-1 text-[10px] border border-border-color rounded text-text-secondary hover:bg-bg-secondary">
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <button type="button" onClick={handleCreate} disabled={saving || !newName.trim()}
                    className="px-2 py-1 text-[10px] bg-accent text-white rounded disabled:opacity-50">
                    {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
