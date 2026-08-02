'use client';

/**
 * SystemNav — the "Your Systems" tier of the sidebar.
 *
 * Replaces the old flat DataSheetNav. Instead of dumping every datasheet into
 * one undifferentiated list, this renders each business **System** (produced by
 * the System Builder AI) as an expandable group whose children are the parts of
 * that system that have a stable route:
 *
 *     ▸ Complaint Management
 *         ▤ Complaints 2026      → /data-sheet/{id}
 *         ▤ Complaint SLA log    → /data-sheet/{id}
 *         ⌥ Pipeline             → /processes/{id}
 *         🤖 Support Agent        → /agents/{id}
 *         📊 Dashboard            → /dashboard?layout={layoutId}
 *
 * Datasheets that don't belong to any System fall into a single "General Data"
 * bucket (with inline quick-create, preserving the old DataSheetNav affordance).
 * A "Build a system" row routes to the AI Conductor at /systems/builder.
 *
 * Data: one /system-builder/nav call (systems + navigable components + the set
 * of system-owned datasheet ids) plus listModels() for the full sheet list —
 * the two are diffed client-side to derive the ungrouped bucket. Both are
 * fetched once, lazily, on first expand and refreshed on route change within
 * /data-sheet, /systems, /processes or /agents.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes, ChevronDown, Database, LayoutList, Plus,
  Workflow, Bot, BarChart3, Sparkles, MessageSquareWarning, TrendingUp, Megaphone,
  Link as LinkIcon, MessageSquare, Users, ListChecks, Radio, UserCog, Settings,
  type LucideIcon,
} from 'lucide-react';
import {
  getSystemsNav, type SystemNavItem, type SystemNavChild,
} from '@/services/system-builder';
import { listModels, createModel, type DynamicModel } from '@/features/data-sheet/api';

/* Lucide icon name (as sent by the backend) → component. Falls back to Link. */
const ICONS: Record<string, LucideIcon> = {
  Database, Workflow, Bot, BarChart3, Link: LinkIcon, MessageSquare, Users,
  ListChecks, Megaphone, Radio, UserCog, Settings, Boxes, LayoutList,
  MessageSquareWarning, TrendingUp, Sparkles,
};
function iconFor(name?: string | null): LucideIcon {
  return (name && ICONS[name]) || LinkIcon;
}

/* System kind → icon + accent dot colour (fallback when a System has no custom
   icon/color of its own — manually-composed Systems set those directly). */
const KIND_META: Record<string, { icon: LucideIcon; dot: string }> = {
  complaint:   { icon: MessageSquareWarning, dot: '#ef4444' },
  sales:       { icon: TrendingUp,           dot: '#10b981' },
  remarketing: { icon: Megaphone,            dot: '#f59e0b' },
  marketing:   { icon: Megaphone,            dot: '#f59e0b' },
  custom:      { icon: Boxes,                dot: '#6366f1' },
};
function kindMeta(kind: string) {
  return KIND_META[kind] ?? KIND_META.custom;
}
/* A System's dot colour: its custom colour if set, else the kind default. */
function systemDot(s: SystemNavItem): string {
  return s.color || kindMeta(s.kind).dot;
}

/* Stable ordering for system kinds so same-coloured systems cluster together
   instead of appearing in whatever order the API returned them. Unknown kinds
   sort last (just before purely-custom ones). */
const KIND_ORDER: Record<string, number> = {
  sales:       0,
  complaint:   1,
  remarketing: 2,
  marketing:   3,
  custom:      4,
};
function kindRank(kind: string) {
  return KIND_ORDER[kind] ?? 3.5; // unknown kinds sit just before "custom"
}

/* Case-insensitive name comparison used everywhere we sort by label. */
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/* Routes whose changes should trigger a nav refresh (a build/edit may have
   added or renamed a component). */
const WATCHED = ['/data-sheet', '/systems', '/processes', '/agents', '/dashboard'];

interface SystemNavProps {
  /** Called after any navigation (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function SystemNav({ onNavigate }: SystemNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [systems, setSystems]   = useState<SystemNavItem[]>([]);
  const [models, setModels]     = useState<DynamicModel[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded]     = useState(false);
  const [loading, setLoading]   = useState(false);

  /* Which system groups are open. Auto-opens the one matching the route. */
  const [openSystems, setOpenSystems] = useState<Set<number>>(new Set());
  const [generalOpen, setGeneralOpen] = useState(false);

  /* Inline quick-create for a General-Data sheet (same UX as old DataSheetNav). */
  const [quickCreate, setQuickCreate] = useState(false);
  const [newName, setNewName]         = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const inWatched = useMemo(
    () => WATCHED.some((r) => pathname === r || pathname?.startsWith(r + '/')),
    [pathname],
  );

  const fetchAll = useCallback(async (force = false) => {
    if ((loaded && !force) || loading) return;
    setLoading(true);
    try {
      const [nav, allModels] = await Promise.all([getSystemsNav(), listModels()]);
      setSystems(nav.systems);
      setOwnedIds(new Set(nav.included_datasheet_ids ?? nav.owned_datasheet_ids));
      setModels(allModels);
      setLoaded(true);
    } catch {
      setLoaded(true); // fail soft — an empty rail beats a broken one
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  /* Lazy-load on first mount so the sidebar never blocks initial paint. */
  useEffect(() => { void fetchAll(); /* eslint-disable-next-line */ }, []);

  /* Refresh (and reconcile) when moving within a watched section. */
  useEffect(() => {
    if (inWatched && loaded) void fetchAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* Auto-open the system whose child route matches the current path. */
  useEffect(() => {
    if (!pathname || systems.length === 0) return;
    const toOpen: number[] = [];
    for (const s of systems) {
      const hit = (s.items ?? []).some((it) => {
        const base = it.href.split('?')[0];
        return base && base !== '/' && pathname.startsWith(base);
      });
      if (hit) toOpen.push(s.id);
    }
    if (toOpen.length) setOpenSystems((prev) => new Set([...prev, ...toOpen]));
  }, [pathname, systems]);

  useEffect(() => {
    if (quickCreate) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [quickCreate]);

  const navigate = (href: string) => { onNavigate?.(); router.push(href); };
  const isActive = (href: string) => pathname === href || !!pathname?.startsWith(href + '/');

  const toggleSystem = (id: number) =>
    setOpenSystems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /* Systems in a stable, organised order: grouped by kind, then alphabetical
     by name within each kind. */
  const sortedSystems = useMemo(
    () =>
      [...systems].sort(
        (a, b) => kindRank(a.kind) - kindRank(b.kind) || byName(a, b),
      ),
    [systems],
  );

  /* Sheets not claimed by any system, alphabetised. */
  const ungrouped = useMemo(
    () =>
      models
        .filter((m) => !ownedIds.has(m.id))
        .sort((a, b) =>
          a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' }),
        ),
    [models, ownedIds],
  );

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = newName.trim();
    if (!displayName) return;
    const slug = slugify(displayName);
    if (!slug) { setCreateError('Name must contain letters or numbers.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const model = await createModel({ name: slug, display_name: displayName, description: null });
      setModels((prev) => [...prev, model]);
      setNewName('');
      setQuickCreate(false);
      navigate(`/data-sheet/${model.id}/settings`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create datasheet.');
    } finally {
      setCreating(false);
    }
  };

  /* ── Leaf row inside a group ──────────────────────────────────────────── */
  const leaf = (label: string, href: string, Icon: LucideIcon, key: string) => {
    const active = isActive(href);
    return (
      <button
        key={key}
        type="button"
        onClick={() => navigate(href)}
        title={label}
        className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left transition-all
          ${active ? 'text-accent font-medium' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`} aria-hidden />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-0.5">

      {/* ── Systems ─────────────────────────────────────────────────────── */}
      {sortedSystems.map((s) => {
        const isOpen = openSystems.has(s.id);
        const detailHref = `/systems/${s.id}`;
        const highlighted = isActive(detailHref) || isOpen;
        const items = s.items ?? [];
        return (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => toggleSystem(s.id)}
              className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left transition-all
                ${highlighted ? 'text-text-primary font-medium' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full mr-2.5" style={{ background: systemDot(s) }} aria-hidden />
              <span className="flex-1 truncate">{s.name}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-text-secondary ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>

            {isOpen && (
              <div className="mt-0.5 ml-[7px] border-l border-border-color pl-3 pb-0.5 space-y-0.5">
                {items.map((it: SystemNavChild, i) =>
                  leaf(it.name, it.href, iconFor(it.icon), `it-${s.id}-${it.type}-${it.id ?? i}`))}
                {items.length === 0 && (
                  <p className="px-2.5 py-1.5 text-[12px] text-text-secondary italic leading-snug">Empty — add items in the overview.</p>
                )}
                {leaf('System overview', detailHref, LayoutList, `ov-${s.id}`)}
              </div>
            )}
          </div>
        );
      })}

      {/* ── General Data (ungrouped sheets) ─────────────────────────────── */}
      {(ungrouped.length > 0 || loaded) && (
        <div>
          <button
            type="button"
            onClick={() => setGeneralOpen((v) => !v)}
            className="group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-all"
          >
            <Database className="h-4 w-4 shrink-0 mr-2.5 text-text-secondary group-hover:text-text-primary" aria-hidden />
            <span className="flex-1 truncate">General Data</span>
            {ungrouped.length > 0 && (
              <span className="mr-1 text-[10px] tabular-nums text-text-secondary/70">{ungrouped.length}</span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-text-secondary ${generalOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {generalOpen && (
            <div className="mt-0.5 ml-[11px] border-l border-border-color pl-3 pb-0.5 space-y-0.5">
              {leaf('View all', '/data-sheet', LayoutList, 'view-all')}

              {quickCreate ? (
                <form onSubmit={handleQuickCreate} className="rounded-lg border border-border-color bg-bg-secondary p-2.5 space-y-2 mt-1">
                  <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">New Data Sheet</p>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuickCreate(false)}
                    placeholder="e.g. Inventory, Clients…"
                    maxLength={128}
                    className="block w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  />
                  {createError && <p className="text-[10px] text-red-500">{createError}</p>}
                  <div className="flex gap-1.5">
                    <button type="submit" disabled={creating || !newName.trim() || !slugify(newName)}
                      className="flex-1 rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {creating ? 'Creating…' : 'Create'}
                    </button>
                    <button type="button" onClick={() => { setQuickCreate(false); setNewName(''); setCreateError(''); }}
                      className="rounded-md border border-border-color px-2 py-1.5 text-[11px] text-text-secondary hover:bg-bg-primary transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setQuickCreate(true)}
                  className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left text-text-secondary hover:bg-bg-secondary hover:text-accent transition-all">
                  <Plus className="h-3.5 w-3.5 shrink-0 text-text-secondary group-hover:text-accent transition-colors" aria-hidden />
                  <span className="truncate">New data sheet</span>
                </button>
              )}

              {(loading || ungrouped.length > 0) && <div className="pt-1 border-t border-border-color/50" />}

              {loading && !loaded ? (
                <div className="px-2.5 py-1.5 text-[12px] text-text-secondary animate-pulse">Loading…</div>
              ) : ungrouped.length === 0 && loaded ? (
                <p className="px-2.5 py-1.5 text-[12px] text-text-secondary italic leading-snug">No ungrouped sheets.</p>
              ) : (
                ungrouped.map((m) => leaf(m.display_name, `/data-sheet/${m.id}`, Database, `un-${m.id}`))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Compose a system manually ───────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/systems?new=1')}
        className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-left text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-all"
      >
        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">New system</span>
      </button>

      {/* ── Build a system (the AI Conductor) ───────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate('/systems/builder')}
        className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-left text-accent/90 hover:bg-accent/10 hover:text-accent transition-all"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Build a system with AI</span>
      </button>
    </div>
  );
}
