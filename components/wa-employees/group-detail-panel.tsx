'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X, Users, Pencil, Check, Trash2, Plus, Search, UserMinus, Phone,
} from 'lucide-react';
import {
  updateGroup, addGroupMembers, removeGroupMember,
  type WaEmployee, type WaEmployeeGroupDetail,
} from '@/services/waEmployees';
import type { ToastType } from '@/components/ui/toast';

/* ─── Avatar helpers ─────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function avatarColor(name: string) {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Inline editable field ─────────────────────────────────────────────── */

function InlineEdit({
  value, placeholder, multiline = false, onSave,
}: {
  value: string;
  placeholder: string;
  multiline?: boolean;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(value);
  const [saving,  setSaving]    = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save() {
    if (draft.trim() === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft.trim()); setEditing(false); }
    finally { setSaving(false); }
  }

  if (editing) {
    const sharedClass = 'w-full px-2 py-1 text-sm border border-accent/60 rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40';
    return (
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className={`${sharedClass} resize-none`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className={sharedClass}
          />
        )}
        <button
          onClick={save}
          disabled={saving || !draft.trim()}
          className="shrink-0 p-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors mt-0.5"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(value); }}
          className="shrink-0 p-1.5 rounded-lg border border-border-color text-text-secondary hover:bg-bg-secondary transition-colors mt-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-start gap-1.5 w-full text-left rounded-lg hover:bg-bg-secondary px-2 py-1 -mx-2 -my-1 transition-colors"
    >
      <span className={`flex-1 text-sm ${value ? 'text-text-primary' : 'text-text-secondary italic'}`}>
        {value || placeholder}
      </span>
      <Pencil className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
    </button>
  );
}

/* ─── Member picker dropdown ─────────────────────────────────────────────── */

function MemberPicker({
  candidates,
  onAdd,
  onClose,
}: {
  candidates: WaEmployee[];
  onAdd: (emp: WaEmployee) => Promise<void>;
  onClose: () => void;
}) {
  const [q,       setQ]       = useState('');
  const [adding,  setAdding]  = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = candidates.filter((e) =>
    !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.whatsapp_number.includes(q)
  );

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 w-64 bg-bg-primary border border-border-color rounded-xl shadow-xl z-20 overflow-hidden"
    >
      <div className="p-2 border-b border-border-color">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employees…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border-color bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-text-secondary text-center">
            {candidates.length === 0 ? 'All active employees are already members' : 'No matches'}
          </p>
        ) : filtered.map((emp) => (
          <button
            key={emp.id}
            disabled={adding === emp.id}
            onClick={async () => {
              setAdding(emp.id);
              await onAdd(emp);
              setAdding(null);
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(emp.name)}`}>
              {initials(emp.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-primary truncate">{emp.name}</p>
              <p className="text-[10px] text-text-secondary font-mono">+{emp.whatsapp_number}</p>
            </div>
            {adding === emp.id && (
              <svg className="w-3 h-3 animate-spin text-accent shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────── */

interface Props {
  group: WaEmployeeGroupDetail | null;
  allEmployees: WaEmployee[];
  onClose: () => void;
  onChanged: () => void;
  onRequestDelete: (group: WaEmployeeGroupDetail) => void;
  addToast: (msg: string, type: ToastType) => void;
}

export function GroupDetailPanel({ group, allEmployees, onClose, onChanged, onRequestDelete, addToast }: Props) {
  const [showPicker,   setShowPicker]   = useState(false);
  const [removingId,   setRemovingId]   = useState<number | null>(null);
  const pickerAnchorRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Reset picker on group change
  useEffect(() => { setShowPicker(false); }, [group?.id]);

  async function handleSaveName(val: string) {
    if (!group) return;
    await updateGroup(group.id, { name: val, description: group.description ?? undefined });
    addToast('Group name updated', 'success');
    onChanged();
  }

  async function handleSaveDescription(val: string) {
    if (!group) return;
    await updateGroup(group.id, { name: group.name, description: val || undefined });
    addToast('Description updated', 'success');
    onChanged();
  }

  async function handleAddMember(emp: WaEmployee) {
    if (!group) return;
    try {
      await addGroupMembers(group.id, [emp.id]);
      addToast(`${emp.name} added to group`, 'success');
      onChanged();
      setShowPicker(false);
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to add member', 'error');
    }
  }

  async function handleRemoveMember(emp: { id: number; name: string }) {
    if (!group) return;
    setRemovingId(emp.id);
    try {
      await removeGroupMember(group.id, emp.id);
      addToast(`${emp.name} removed from group`, 'info');
      onChanged();
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to remove member', 'error');
    } finally {
      setRemovingId(null);
    }
  }

  // Employees not yet in this group (and active)
  const memberIds   = new Set(group?.members.map((m) => m.id) ?? []);
  const candidates  = allEmployees.filter((e) => e.status === 'active' && !memberIds.has(e.id));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300
          ${group ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-color shadow-2xl z-40
          flex flex-col transition-transform duration-300 ease-in-out
          ${group ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {group && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <h2 className="text-sm font-semibold text-text-primary">Group Details</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Name & description */}
              <div className="px-5 py-5 border-b border-border-color space-y-4">
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Name</p>
                  <InlineEdit
                    value={group.name}
                    placeholder="Group name"
                    onSave={handleSaveName}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Description</p>
                  <InlineEdit
                    value={group.description ?? ''}
                    placeholder="Add a description…"
                    multiline
                    onSave={handleSaveDescription}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Created {new Date(group.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {/* Members */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Members</span>
                    <span className="px-1.5 py-0.5 bg-bg-secondary text-text-secondary text-xs rounded-full border border-border-color">
                      {group.members.length}
                    </span>
                  </div>

                  {/* Add member button + picker */}
                  <div className="relative" ref={pickerAnchorRef}>
                    <button
                      onClick={() => setShowPicker((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add member
                    </button>
                    {showPicker && (
                      <MemberPicker
                        candidates={candidates}
                        onAdd={handleAddMember}
                        onClose={() => setShowPicker(false)}
                      />
                    )}
                  </div>
                </div>

                {group.members.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary">
                    <Users className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No members yet</p>
                    <p className="text-xs mt-0.5">Click "Add member" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {group.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-bg-secondary transition-colors group"
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(member.name)}`}>
                          {initials(member.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                          <p className="text-xs text-text-secondary font-mono">+{member.whatsapp_number}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member)}
                          disabled={removingId === member.id}
                          className="shrink-0 p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                          title="Remove from group"
                        >
                          {removingId === member.id
                            ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            : <UserMinus className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Danger zone footer */}
            <div className="shrink-0 border-t border-border-color px-5 py-4">
              <button
                onClick={() => onRequestDelete(group)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left border border-red-200 dark:border-red-900"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-medium">Delete Group</div>
                  <div className="text-xs text-red-400">Removes group and all member links</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
