'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Check, Trash2, LayoutGrid } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

export interface Layout {
  id: number;
  business_id: number;
  user_id: number | null;
  name: string;
  role_template: string | null;
  is_active: boolean;
  sort_order: number;
  widget_count: number;
}

const ROLE_OPTIONS = [
  { value: 'owner',     label: 'Owner view (broad overview)' },
  { value: 'manager',   label: 'Manager view (tasks & ops)' },
  { value: 'executive', label: 'Executive view (key signals)' },
];

export function LayoutSwitcher({
  layouts,
  activeId,
  onChange,
}: {
  layouts: Layout[];
  activeId: number | null;
  onChange: () => void;       // called after any mutation that should re-fetch layouts/widgets
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'manager' | 'executive'>('owner');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = layouts.find((l) => l.id === activeId) ?? layouts[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function activate(id: number) {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/widgets/layouts/${id}/activate`, { method: 'POST' });
      onChange();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function createLayout() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await apiFetch('/widgets/layouts', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), role_template: newRole, seed_defaults: true }),
      });
      setNewName('');
      setCreating(false);
      onChange();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function removeLayout(id: number) {
    if (busy || layouts.length <= 1) return;
    if (!confirm('Delete this layout? Its widgets will be removed.')) return;
    setBusy(true);
    try {
      await apiFetch(`/widgets/layouts/${id}`, { method: 'DELETE' });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-card-bg border border-border-color text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <LayoutGrid size={14} className="text-text-secondary" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'Default'}</span>
        <ChevronDown size={13} className="text-text-secondary" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-card-bg border border-border-color rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Layouts
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {layouts.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-bg-secondary group cursor-pointer"
                onClick={() => activate(l.id)}
              >
                <Check size={14} className={l.is_active ? 'text-emerald-500' : 'text-transparent'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{l.name}</p>
                  <p className="text-[10px] text-text-secondary opacity-70">
                    {l.widget_count} widget{l.widget_count === 1 ? '' : 's'}
                    {l.role_template ? ` · ${l.role_template}` : ''}
                  </p>
                </div>
                {layouts.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLayout(l.id); }}
                    className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border-color p-2">
            {creating ? (
              <div className="space-y-2 p-1">
                <input
                  type="text"
                  placeholder="Layout name (e.g. Sales)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-sm text-text-primary"
                  autoFocus
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'owner' | 'manager' | 'executive')}
                  className="w-full px-2 py-1.5 rounded-lg border border-border-color bg-bg-secondary text-xs text-text-primary"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={createLayout}
                    disabled={!newName.trim() || busy}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-accent hover:bg-bg-secondary"
              >
                <Plus size={13} /> New layout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
