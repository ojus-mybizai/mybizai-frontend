'use client';

/**
 * SystemComposer — the manual composition editor embedded in a System's
 * overview. Lists the System's current children with:
 *   • native drag-sort (persisted via /components/order),
 *   • detach (link → just unlink; owned → keep-or-delete confirm),
 *   • an "Add items" picker (existing datasheets/pipelines/agents/dashboards,
 *     core-module shortcuts, and custom external links).
 *
 * Owner-gated by the caller (only rendered when `manage_settings`). It owns its
 * own `rows` state and re-reads from getSystem after each mutation so the list
 * stays authoritative; `onChanged` lets the parent refresh its own counts.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Database, Workflow, Bot, BarChart3, Link as LinkIcon, GripVertical,
  Plus, Trash2, Loader2, ExternalLink, X, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  getSystem, attachComponents, detachComponent, reorderComponents,
  getPickableItems, type SystemComponent, type PickableItems,
  type AttachComponent, type NavChildType,
} from '@/services/system-builder';

const TYPE_ICON: Record<string, LucideIcon> = {
  datasheet_model: Database,
  pipeline: Workflow,
  agent: Bot,
  dashboard_layout: BarChart3,
  nav_link: LinkIcon,
};
const TYPE_LABEL: Record<string, string> = {
  datasheet_model: 'Datasheet',
  pipeline: 'Pipeline',
  agent: 'Agent',
  dashboard_layout: 'Dashboard',
  nav_link: 'Shortcut',
};

function childHref(c: SystemComponent): string | null {
  switch (c.type) {
    case 'datasheet_model': return `/data-sheet/${c.component_id}`;
    case 'pipeline': return `/processes/${c.component_id}`;
    case 'agent': return `/agents/${c.component_id}`;
    case 'dashboard_layout': return `/dashboard?layout=${c.component_id}`;
    case 'nav_link': return (c.meta?.href as string) || null;
    default: return null;
  }
}
function childName(c: SystemComponent): string {
  if (c.type === 'nav_link') {
    return (
      (c.meta?.label_custom as string) ||
      (c.meta?.label as string) ||
      c.ref_key ||
      'Shortcut'
    );
  }
  return c.ref_key || TYPE_LABEL[c.type] || c.type;
}

/* Only these types are manually attachable/detachable via this editor. */
const MANUAL_TYPES = new Set(['datasheet_model', 'pipeline', 'agent', 'dashboard_layout', 'nav_link']);

export default function SystemComposer({
  systemId,
  initialComponents,
  onChanged,
}: {
  systemId: number;
  initialComponents: SystemComponent[];
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<SystemComponent[]>(initialComponents);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [confirmOwned, setConfirmOwned] = useState<SystemComponent | null>(null);

  useEffect(() => { setRows(initialComponents); }, [initialComponents]);

  const reload = useCallback(async () => {
    const fresh = await getSystem(systemId);
    setRows(fresh.components);
    onChanged?.();
  }, [systemId, onChanged]);

  const navigable = rows.filter((r) => MANUAL_TYPES.has(r.type));

  /* ── drag-sort (native HTML5) ─────────────────────────────────────────── */
  const onDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) { setDragId(null); return; }
    const ids = navigable.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setDragId(null);
    // optimistic reorder
    const byId = new Map(rows.map((r) => [r.id, r]));
    setRows(next.map((id) => byId.get(id)!).filter(Boolean));
    try {
      await reorderComponents(systemId, next);
    } catch {
      void reload(); // fall back to server truth on failure
    }
  };

  const doDetach = async (row: SystemComponent, deleteConfig?: boolean) => {
    setBusy(true);
    try {
      await detachComponent(systemId, row.id, deleteConfig);
      await reload();
    } finally {
      setBusy(false);
      setConfirmOwned(null);
    }
  };

  const handleDetachClick = (row: SystemComponent) => {
    if (row.owned) setConfirmOwned(row);       // owned → ask keep-or-delete
    else void doDetach(row);                    // link → just unlink
  };

  return (
    <div className="rounded-2xl border border-border-color bg-card-bg p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Items in this system</h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-2.5 py-1.5 text-[12px] font-medium text-text-primary hover:border-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Add items
        </button>
      </div>

      {navigable.length === 0 ? (
        <p className="mt-3 text-[13px] italic text-text-secondary">
          Nothing here yet. Use “Add items” to group your datasheets, pipelines, agents and shortcuts.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {navigable.map((c) => {
            const Icon = TYPE_ICON[c.type] || LinkIcon;
            const href = childHref(c);
            return (
              <li
                key={c.id}
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(c.id)}
                className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                  dragId === c.id ? 'border-accent opacity-60' : 'border-border-color'
                }`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-secondary/60" aria-hidden />
                <Icon className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                  {childName(c)}
                  <span className="ml-1.5 text-[11px] text-text-secondary">{TYPE_LABEL[c.type] ?? c.type}</span>
                  {c.owned && (
                    <span className="ml-1.5 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-medium text-accent">owned</span>
                  )}
                </span>
                {href && (
                  <Link
                    href={href}
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent opacity-0 transition group-hover:opacity-100 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleDetachClick(c)}
                  disabled={busy}
                  title={c.owned ? 'Remove (choose keep or delete)' : 'Unlink from this system'}
                  className="shrink-0 rounded p-1 text-text-secondary hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen && (
        <PickerModal
          systemId={systemId}
          onClose={() => setPickerOpen(false)}
          onAttached={async () => { setPickerOpen(false); await reload(); }}
        />
      )}

      {confirmOwned && (
        <OwnedDetachModal
          row={confirmOwned}
          busy={busy}
          onCancel={() => setConfirmOwned(null)}
          onKeep={() => doDetach(confirmOwned, false)}
          onDelete={() => doDetach(confirmOwned, true)}
        />
      )}
    </div>
  );
}

/* ── Picker modal ───────────────────────────────────────────────────────── */

function PickerModal({
  systemId,
  onClose,
  onAttached,
}: {
  systemId: number;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [data, setData] = useState<PickableItems | null>(null);
  const [selected, setSelected] = useState<AttachComponent[]>([]);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPickableItems().then(setData).catch((e) => setErr((e as Error).message));
  }, []);

  const isSel = (type: NavChildType, id: number) =>
    selected.some((s) => s.type === type && s.id === id);
  const toggle = (type: NavChildType, id: number) =>
    setSelected((prev) =>
      isSel(type, id) ? prev.filter((s) => !(s.type === type && s.id === id)) : [...prev, { type, id }],
    );

  const section = (
    title: string,
    type: NavChildType,
    items: PickableItems['datasheets'] | undefined,
  ) => {
    if (!items || items.length === 0) return null;
    return (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
        <div className="space-y-1">
          {items.map((it) => {
            const already = it.in_systems.includes(systemId);
            return (
              <label
                key={it.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] ${
                  already ? 'border-transparent opacity-60' : 'cursor-pointer border-border-color hover:border-accent'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={already}
                  checked={already || isSel(type, it.id)}
                  onChange={() => toggle(type, it.id)}
                  className="accent-accent"
                />
                <span className="min-w-0 flex-1 truncate text-text-primary">{it.name}</span>
                {already && <span className="text-[11px] text-text-secondary">Added</span>}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  async function handleAttach() {
    const payload: AttachComponent[] = [...selected];
    if (linkHref.trim() && linkLabel.trim()) {
      payload.push({ type: 'nav_link', href: linkHref.trim(), label: linkLabel.trim() });
    }
    if (payload.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      await attachComponents(systemId, payload);
      onAttached();
    } catch (e) {
      setErr((e as Error).message || 'Could not attach items.');
      setBusy(false);
    }
  }

  const coreSelected = (module: string) =>
    selected.some((s) => s.type === 'nav_link' && s.module === module);
  const toggleCore = (m: PickableItems['core_modules'][number]) =>
    setSelected((prev) =>
      coreSelected(m.module)
        ? prev.filter((s) => !(s.type === 'nav_link' && s.module === m.module))
        : [...prev, { type: 'nav_link', href: m.href, label: m.label, icon: m.icon, module: m.module }],
    );

  const count = selected.length + (linkHref.trim() && linkLabel.trim() ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border-color bg-bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-color px-5 py-3.5">
          <h2 className="text-base font-bold text-text-primary">Add items to this system</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!data && !err && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {err && (
            <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">{err}</div>
          )}
          {data && (
            <>
              {section('Datasheets', 'datasheet_model', data.datasheets)}
              {section('Pipelines', 'pipeline', data.pipelines)}
              {section('Agents', 'agent', data.agents)}
              {section('Dashboards', 'dashboard_layout', data.dashboards)}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Core modules</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.core_modules.map((m) => (
                    <button
                      key={m.module}
                      type="button"
                      onClick={() => toggleCore(m)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
                        coreSelected(m.module)
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-border-color text-text-primary hover:border-accent'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Custom link</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Label"
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent sm:w-1/3"
                  />
                  <input
                    value={linkHref}
                    onChange={(e) => setLinkHref(e.target.value)}
                    placeholder="https://… or /route"
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-color px-5 py-3.5">
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
            onClick={handleAttach}
            disabled={count === 0 || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add{count > 0 ? ` ${count}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Keep-or-delete confirm for an owned component ────────────────────────── */

function OwnedDetachModal({
  row,
  busy,
  onCancel,
  onKeep,
  onDelete,
}: {
  row: SystemComponent;
  busy: boolean;
  onCancel: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-color bg-bg-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">Remove “{childName(row)}”?</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              This item was built as part of the system, so it’s owned by it. Choose whether to keep the
              underlying configuration or delete it entirely.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onKeep}
            disabled={busy}
            className="rounded-lg border border-border-color px-3 py-2 text-left text-[13px] hover:border-accent disabled:opacity-50"
          >
            <span className="font-semibold text-text-primary">Keep it, just unlink</span>
            <span className="block text-text-secondary">Removes it from this system; the config stays and moves to General.</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-left text-[13px] hover:bg-danger/10 disabled:opacity-50"
          >
            <span className="font-semibold text-danger">Delete the configuration</span>
            <span className="block text-danger/80">Permanently deletes it and its data. Cannot be undone.</span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-border-color px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-card-bg disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
