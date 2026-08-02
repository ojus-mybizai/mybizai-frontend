'use client';

import { useEffect, useState } from 'react';
import { X, Tags, Plus, Trash2, Loader2, Lock, Check, Pencil } from 'lucide-react';
import {
  listSourceDefs,
  createSourceDef,
  updateSourceDef,
  deleteSourceDef,
  type ContactSourceDef,
} from '@/services/contact-source-defs';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after any change so the parent can refresh its cached source list. */
  onChanged?: (defs: ContactSourceDef[]) => void;
}

// Preset swatches offered when creating / recoloring a source.
const SWATCHES = [
  '#6366f1', '#22c55e', '#ec4899', '#3b82f6', '#0088cc',
  '#1d4ed8', '#16a34a', '#f59e0b', '#f97316', '#6b7280',
  '#ea4335', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6',
];

/**
 * Manage the business-configurable "Source" picklist (how a contact was
 * acquired). Every source — built-in or custom — supports full CRUD
 * (rename / recolor / delete). Backs the Source dropdown in the
 * create-contact modal and the Source facet in the filter rail.
 */
export function ManageSourcesModal({ open, onClose, onChanged }: Props) {
  const [defs, setDefs] = useState<ContactSourceDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // New-source form
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [creating, setCreating] = useState(false);

  // Inline edit / delete state (keyed by source id)
  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    listSourceDefs()
      .then(setDefs)
      .catch(() => setError('Failed to load sources.'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const commit = (next: ContactSourceDef[]) => {
    setDefs(next);
    onChanged?.(next);
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label || creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await createSourceDef({ label, color: newColor });
      commit([...defs, created]);
      setNewLabel('');
      setNewColor(SWATCHES[0]);
    } catch {
      setError('Could not create the source.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (s: ContactSourceDef) => {
    setEditId(s.id);
    setEditLabel(s.label);
    setEditColor(s.color ?? SWATCHES[0]);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (editId == null) return;
    const label = editLabel.trim();
    if (!label || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateSourceDef(editId, { label, color: editColor });
      commit(defs.map(d => (d.id === updated.id ? updated : d)));
      setEditId(null);
    } catch {
      setError('Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: ContactSourceDef) => {
    setDeletingId(s.id);
    setError('');
    try {
      await deleteSourceDef(s.id);
      commit(defs.filter(d => d.id !== s.id));
    } catch {
      setError('Could not delete the source.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border-color bg-card-bg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-color flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <Tags className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Contact Sources</h2>
              <p className="text-[11px] text-text-secondary">How contacts were acquired — used in the Add-Contact form and filters</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Add new source */}
          <div className="rounded-xl border border-border-color bg-bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-2">Add a source</p>
            <div className="flex items-center gap-2">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Trade Show, Referral…"
                className="flex-1 px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-accent hover:bg-accent/90 text-white font-medium disabled:opacity-60"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
            <ColorSwatches value={newColor} onChange={setNewColor} />
          </div>

          {/* Source list */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <ul className="space-y-1.5">
              {defs.map(s => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border-color bg-bg-primary px-3 py-2.5"
                >
                  {editId === s.id ? (
                    /* Inline edit */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          className="flex-1 px-3 py-1.5 text-sm border border-border-color rounded-lg bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving || !editLabel.trim()}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent/90 text-white font-medium disabled:opacity-60"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-border-color text-text-secondary hover:bg-bg-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                      <ColorSwatches value={editColor} onChange={setEditColor} />
                    </div>
                  ) : (
                    /* Read row */
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.color ?? '#6366f1' }}
                      />
                      <span className="flex-1 text-sm text-text-primary font-medium truncate">{s.label}</span>
                      {s.is_default && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">Default</span>
                      )}
                      {s.is_system && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary/70" title="Built-in source — can be renamed, recolored, or deleted">
                          <Lock className="w-3 h-3" /> Built-in
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                        title="Rename / recolor"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {deletingId === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
                      ) : (
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1.5 rounded-md text-text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {defs.length === 0 && (
                <li className="text-center text-sm text-text-secondary py-6">No sources yet — add one above.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Color swatch row ───────────────────────────────────────────────
function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {SWATCHES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform ${value === c ? 'ring-2 ring-offset-1 ring-accent scale-110' : 'hover:scale-110'}`}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}
