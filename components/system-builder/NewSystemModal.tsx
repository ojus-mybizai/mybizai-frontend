'use client';

/**
 * NewSystemModal — create an empty, manually-composed System.
 *
 * Collects a name, an icon and a colour (the appearance shown in the sidebar
 * and on the /systems cards) and an optional one-line goal. On success it hands
 * the created SystemSummary back to the caller, which typically routes to the
 * System's overview so the owner can start attaching items.
 */

import { useState } from 'react';
import {
  Boxes, Workflow, Database, Bot, BarChart3, Users, Megaphone,
  MessageSquare, ListChecks, Settings, Loader2, X, type LucideIcon,
} from 'lucide-react';
import { createSystem, type SystemSummary } from '@/services/system-builder';

/* Icon choices offered in the picker — keys match the backend/sidebar names. */
const ICON_CHOICES: { name: string; Icon: LucideIcon }[] = [
  { name: 'Boxes', Icon: Boxes },
  { name: 'Workflow', Icon: Workflow },
  { name: 'Database', Icon: Database },
  { name: 'Bot', Icon: Bot },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'Users', Icon: Users },
  { name: 'Megaphone', Icon: Megaphone },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'ListChecks', Icon: ListChecks },
  { name: 'Settings', Icon: Settings },
];

const COLOR_CHOICES = [
  '#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#64748b',
];

export default function NewSystemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: SystemSummary) => void;
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [icon, setIcon] = useState('Boxes');
  const [color, setColor] = useState('#6366f1');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const s = await createSystem({ name: trimmed, icon, color, goal: goal.trim() || undefined });
      onCreated(s);
    } catch (e) {
      setErr((e as Error).message || 'Could not create the system.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-color bg-bg-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">New system</h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              Group existing datasheets, pipelines, agents and shortcuts under one named folder.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-[13px] font-medium text-text-primary">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            maxLength={255}
            placeholder="e.g. Sales, Onboarding, Support"
            className="mt-1.5 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>

        <div className="mt-4">
          <p className="text-[13px] font-medium text-text-primary">Icon</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ICON_CHOICES.map(({ name: n, Icon }) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                title={n}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  icon === n ? 'border-accent bg-accent-soft text-accent' : 'border-border-color text-text-secondary hover:border-accent'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[13px] font-medium text-text-primary">Colour</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className={`h-7 w-7 rounded-full border-2 transition ${color === c ? 'border-text-primary' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <label className="mt-4 block text-[13px] font-medium text-text-primary">
          Goal <span className="font-normal text-text-secondary">(optional)</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="What is this system for?"
            className="mt-1.5 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>

        {err && (
          <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border-color px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-card-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create system
          </button>
        </div>
      </div>
    </div>
  );
}
