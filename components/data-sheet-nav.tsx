'use client';

/**
 * DataSheetNav — Sidebar collapsible group for Data Sheets.
 *
 * Mirrors the NavGroup design used in app-shell: same chevron rotation,
 * same indented children with left-border connector, same sizing tokens.
 * Dynamic — fetches all datasheets on first open and keeps them in sync.
 */

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Database, ChevronDown, Plus, LayoutList } from 'lucide-react';
import { listModels, createModel, type DynamicModel } from '@/features/data-sheet/api';

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function DataSheetNav({ onNavigate }: { onNavigate?: () => void }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [open,      setOpen]      = useState(false);
  const [allModels, setAllModels] = useState<DynamicModel[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  /* Quick-create inline form */
  const [quickCreate,  setQuickCreate]  = useState(false);
  const [newName,      setNewName]      = useState('');
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isDataSheetRoute = !!pathname?.startsWith('/data-sheet');

  const fetchModels = async (force = false) => {
    if ((loaded && !force) || loading) return;
    setLoading(true);
    try {
      const data = await listModels();
      setAllModels(data);
      setLoaded(true);
    } catch {
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  /* Auto-open when navigating into any /data-sheet route */
  useEffect(() => {
    if (isDataSheetRoute) {
      setOpen(true);
      void fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataSheetRoute]);

  /* Refresh list when pathname changes within /data-sheet */
  useEffect(() => {
    if (isDataSheetRoute && loaded) void fetchModels(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* Focus quick-create input when it opens */
  useEffect(() => {
    if (quickCreate) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [quickCreate]);

  const navigate = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void fetchModels();
  };

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
      setAllModels((prev) => [...prev, model]);
      setNewName('');
      setQuickCreate(false);
      navigate(`/data-sheet/${model.id}/settings`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create datasheet.');
    } finally {
      setCreating(false);
    }
  };

  const cancelQuickCreate = () => {
    setQuickCreate(false);
    setNewName('');
    setCreateError('');
  };

  return (
    <div className="space-y-0.5">

      {/* ── Group trigger — matches NavGroup style exactly ── */}
      <button
        type="button"
        onClick={handleToggle}
        className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left transition-all
          ${isDataSheetRoute
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          }`}
      >
        <Database
          className={`h-4 w-4 shrink-0 mr-2.5 transition-colors
            ${isDataSheetRoute ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
          aria-hidden
        />
        <span className="flex-1 truncate">Data Sheets</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200
            ${open ? 'rotate-180' : ''}
            ${isDataSheetRoute ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
          aria-hidden
        />
      </button>

      {/* ── Children panel — matches NavGroup children style ── */}
      {open && (
        <div className="mt-0.5 ml-[11px] border-l border-border-color pl-3 pb-0.5 space-y-0.5">

          {/* View all */}
          <button
            type="button"
            onClick={() => navigate('/data-sheet')}
            className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left transition-all
              ${pathname === '/data-sheet'
                ? 'text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              }`}
          >
            <LayoutList
              className={`h-3.5 w-3.5 shrink-0
                ${pathname === '/data-sheet' ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
              aria-hidden
            />
            <span className="truncate">View all</span>
          </button>

          {/* New datasheet */}
          {quickCreate ? (
            <form
              onSubmit={handleQuickCreate}
              className="rounded-lg border border-border-color bg-bg-secondary p-2.5 space-y-2 mt-1"
            >
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                New Data Sheet
              </p>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && cancelQuickCreate()}
                placeholder="e.g. Inventory, Clients…"
                maxLength={128}
                className="block w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
              {createError && (
                <p className="text-[10px] text-red-500">{createError}</p>
              )}
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !slugify(newName)}
                  className="flex-1 rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={cancelQuickCreate}
                  className="rounded-md border border-border-color px-2 py-1.5 text-[11px] text-text-secondary hover:bg-bg-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setQuickCreate(true)}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left text-text-secondary hover:bg-bg-secondary hover:text-accent transition-all"
            >
              <Plus
                className="h-3.5 w-3.5 shrink-0 text-text-secondary group-hover:text-accent transition-colors"
                aria-hidden
              />
              <span className="truncate">New data sheet</span>
            </button>
          )}

          {/* Divider */}
          {(loading || allModels.length > 0) && (
            <div className="pt-1 border-t border-border-color/50" />
          )}

          {/* Dynamic list */}
          {loading && !loaded ? (
            <div className="px-2.5 py-1.5 text-[12px] text-text-secondary animate-pulse">
              Loading…
            </div>
          ) : allModels.length === 0 && loaded ? (
            <p className="px-2.5 py-1.5 text-[12px] text-text-secondary italic leading-snug">
              No data sheets yet.
            </p>
          ) : (
            allModels.map((model) => {
              const active =
                pathname === `/data-sheet/${model.id}` ||
                !!pathname?.startsWith(`/data-sheet/${model.id}/`);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => navigate(`/data-sheet/${model.id}`)}
                  title={model.display_name}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-left transition-all
                    ${active
                      ? 'text-accent font-medium'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    }`}
                >
                  <Database
                    className={`h-3.5 w-3.5 shrink-0
                      ${active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
                    aria-hidden
                  />
                  <span className="truncate">{model.display_name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
