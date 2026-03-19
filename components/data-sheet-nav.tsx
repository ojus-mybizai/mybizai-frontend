'use client';

/**
 * DataSheetNav — Sidebar dropdown for Data Sheets.
 *
 * Shows only STARRED datasheets in the sidebar.
 * Users star sheets from the main /data-sheet page.
 *
 * • Lazy-loads all models on first open, then filters to starred
 * • "+ New datasheet" → quick-create by name → goes to /data-sheet/{id}/settings so user can add fields
 * • "View all →" link always present at the bottom
 * • Auto-opens when on any /data-sheet/* route
 */

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sheet } from 'lucide-react';
import { listModels, createModel, type DynamicModel } from '@/features/data-sheet/api';
import { useStarredDatasheets } from '@/lib/use-starred-datasheets';

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function DataSheetNav({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [allModels, setAllModels] = useState<DynamicModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Quick-create
  const [quickCreate, setQuickCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { starred, isStarred } = useStarredDatasheets();

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

  // Auto-open when navigating into any /data-sheet route
  useEffect(() => {
    if (isDataSheetRoute) {
      setOpen(true);
      void fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataSheetRoute]);

  // Refresh list when pathname changes within /data-sheet
  useEffect(() => {
    if (isDataSheetRoute && loaded) void fetchModels(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Focus quick-create input when it opens
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
      // Navigate to settings so user can add fields right away
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

  // Only show starred models in the sidebar
  const starredModels = allModels.filter((m) => isStarred(m.id));

  return (
    <div className="space-y-0.5">
      {/* Main toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-between rounded-md px-3 py-3 text-sm text-left transition-colors ${
          isDataSheetRoute
            ? 'bg-card-bg text-text-primary'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-color bg-bg-secondary text-text-secondary">
            <Sheet className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="truncate">Data Sheet</span>
        </div>
        <span className="text-xs text-text-secondary select-none">{open ? '▾' : '▸'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ml-8 border-l border-border-color pl-3 pb-1 space-y-0.5 text-xs">

          {/* Starred sheet list */}
          {loading && !loaded ? (
            <div className="py-2 pl-2 text-text-secondary animate-pulse">Loading…</div>
          ) : starredModels.length === 0 ? (
            <div className="py-2 pl-2 space-y-0.5">
              <p className="text-text-secondary italic text-[11px] leading-snug">
                No pinned sheets yet.
              </p>
              <p className="text-text-secondary/70 text-[10px] leading-snug">
                Star a sheet from the Data Sheet page to pin it here.
              </p>
            </div>
          ) : (
            starredModels.map((model) => {
              const active =
                pathname === `/data-sheet/${model.id}` ||
                !!pathname?.startsWith(`/data-sheet/${model.id}/`);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => navigate(`/data-sheet/${model.id}`)}
                  title={model.display_name}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                    active
                      ? 'bg-card-bg text-text-primary font-semibold'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="text-amber-400 text-[10px] leading-none">★</span>
                  <span className="truncate">{model.display_name}</span>
                </button>
              );
            })
          )}

          {/* Divider */}
          <div className="pt-1 border-t border-border-color/50" />

          {/* View all link */}
          <button
            type="button"
            onClick={() => navigate('/data-sheet')}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
              pathname === '/data-sheet'
                ? 'text-text-primary font-semibold'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            }`}
          >
            <span className="text-[11px]">☰</span>
            <span>View all sheets</span>
          </button>

          {/* Quick-create */}
          {quickCreate ? (
            <form
              onSubmit={handleQuickCreate}
              className="mt-1 rounded-lg border border-border-color bg-bg-secondary p-2 space-y-1.5"
            >
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">
                New Datasheet
              </p>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && cancelQuickCreate()}
                placeholder="e.g. Inventory, Clients…"
                maxLength={128}
                className="block w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
              {newName.trim() && (
                <p className="text-[10px] text-text-secondary">
                  slug: <code className="rounded bg-bg-primary px-1">{slugify(newName) || '—'}</code>
                </p>
              )}
              {createError && <p className="text-[10px] text-red-500">{createError}</p>}
              <div className="flex gap-1 pt-0.5">
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !slugify(newName)}
                  className="flex-1 rounded bg-accent px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create & add fields →'}
                </button>
                <button
                  type="button"
                  onClick={cancelQuickCreate}
                  className="rounded border border-border-color px-2 py-1.5 text-[11px] text-text-secondary hover:bg-bg-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setQuickCreate(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-text-secondary hover:bg-bg-secondary hover:text-accent transition-colors group"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-dashed border-current text-sm font-bold group-hover:border-accent">
                +
              </span>
              <span>New datasheet</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
