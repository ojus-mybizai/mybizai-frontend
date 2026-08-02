'use client';

/**
 * PinToSystemButton — a header affordance that pins the *current* filtered view
 * to one or more Systems as a scoped nav_link (a "filtered shortcut").
 *
 * It reads the live pathname + query via the scoped-link adapter registry
 * (`lib/system-scoped-links.ts`). If the current view isn't pinnable, the button
 * renders nothing. Otherwise it opens a modal to pick target System(s) and edit
 * the auto-derived label. Owner-gated (manage_settings) — the attach endpoint is
 * owner-gated too, so non-managers never see it.
 *
 * Drop `<PinToSystemButton />` into any supported page header; pass `labelHint`
 * when the page knows a nicer label than the URL alone (e.g. the active group's
 * real name).
 */

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Pin, Loader2, X, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { parseScope, type ParsedScope } from '@/lib/system-scoped-links';
import {
  listSystems, attachComponents, type SystemSummary,
} from '@/services/system-builder';

export default function PinToSystemButton({
  labelHint,
  className,
  override,
  compact,
}: {
  /** Overrides the adapter's fallback auto-label in the modal preview. */
  labelHint?: string;
  className?: string;
  /** Icon-only (no "Pin to system" text) for tight headers. */
  compact?: boolean;
  /** Explicit scope, bypassing URL parsing. Pass `null` to force-hide. Used by
   * pages whose filter state isn't reflected in the router's searchParams (e.g.
   * the inbox syncs `?view=` via history.replaceState). `undefined` = parse URL. */
  override?: ParsedScope | null;
}) {
  const canManage = useAuthStore((s) => s.hasPermission('manage_settings'));
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const parsed: ParsedScope | null = useMemo(() => {
    if (override !== undefined) return override;
    const q = new URLSearchParams(searchParams?.toString() ?? '');
    return parseScope(pathname ?? '', q);
  }, [override, pathname, searchParams]);

  const [open, setOpen] = useState(false);

  if (!canManage || !parsed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Pin this filtered view to a system"
        className={
          className ??
          'inline-flex items-center gap-1.5 rounded-lg border border-border-color px-2.5 py-1.5 text-[13px] font-medium text-text-secondary hover:border-accent hover:text-text-primary'
        }
      >
        <Pin className="h-3.5 w-3.5" /> {!compact && 'Pin to system'}
      </button>
      {open && (
        <PinModal
          parsed={parsed}
          defaultLabel={labelHint || parsed.autoLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PinModal({
  parsed,
  defaultLabel,
  onClose,
}: {
  parsed: ParsedScope;
  defaultLabel: string;
  onClose: () => void;
}) {
  const [systems, setSystems] = useState<SystemSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [label, setLabel] = useState(defaultLabel);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    listSystems()
      .then((r) => setSystems(r.systems))
      .catch((e) => setErr((e as Error).message || 'Could not load systems.'));
  }, []);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function handlePin() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // Only send the label as an override when the owner actually edited it;
      // otherwise let the backend resolve (and keep live) its own auto-label.
      const override = edited ? label.trim() : undefined;
      await Promise.all(
        [...selected].map((sysId) =>
          attachComponents(sysId, [
            { type: 'nav_link', scope: parsed.descriptor, icon: parsed.icon, label: override },
          ]),
        ),
      );
      setDone(true);
      setTimeout(onClose, 700);
    } catch (e) {
      setErr((e as Error).message || 'Could not pin this view.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border-color bg-bg-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-color px-5 py-3.5">
          <h2 className="inline-flex items-center gap-2 text-base font-bold text-text-primary">
            <Pin className="h-4 w-4 text-accent" /> Pin view to system
          </h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Label */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Label
            </label>
            <input
              value={label}
              onChange={(e) => { setLabel(e.target.value); setEdited(true); }}
              placeholder="Shortcut label"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
            />
            {!edited && (
              <p className="mt-1 text-[11px] text-text-secondary">
                Auto-named from your filters — stays in sync if the target is renamed. Edit to fix a custom label.
              </p>
            )}
          </div>

          {/* System picker */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Add to system{selected.size > 1 ? 's' : ''}
            </p>
            {systems === null && !err && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {systems !== null && systems.length === 0 && (
              <p className="text-[13px] italic text-text-secondary">
                No systems yet. Create one from the sidebar’s “New system”.
              </p>
            )}
            <div className="space-y-1">
              {(systems ?? []).map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-color px-2.5 py-1.5 text-[13px] hover:border-accent"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="accent-accent"
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color || '#6366f1' }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-text-primary">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {err && (
            <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {err}
            </div>
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
            onClick={handlePin}
            disabled={selected.size === 0 || busy || done}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {done ? <Check className="h-4 w-4" /> : busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className="h-4 w-4" />}
            {done ? 'Pinned' : `Pin${selected.size > 0 ? ` to ${selected.size}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
