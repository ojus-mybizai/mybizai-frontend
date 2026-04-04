'use client';

/**
 * DataSheetNav — Sidebar dropdown for Data.
 *
 * Shows all datasheets in a dropdown list.
 * Top items: "View all" and "+ New datasheet"
 * Then lists all datasheets below.
 */

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Database } from 'lucide-react';
import { listModels, createModel, type DynamicModel } from '@/features/data-sheet/api';

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
      {/* Main toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left transition-all ${
          isDataSheetRoute
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
        }`}
      >
        <Database
          className={`h-4 w-4 shrink-0 transition-colors mr-2.5 ${
            isDataSheetRoute ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
          }`}
          aria-hidden
        />
        <span className="truncate flex-1">Data</span>
        <span className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''} ${isDataSheetRoute ? 'text-accent' : 'text-text-secondary'}`}>
          ▸
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ml-6 border-l border-border-color pl-3 pb-1 space-y-0.5 text-xs">

          {/* View all link */}
          <button
            type="button"
            onClick={() => navigate('/data-sheet')}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
              pathname === '/data-sheet'
                ? 'text-accent font-semibold'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            }`}
          >
            <span>View all</span>
          </button>

          {/* New datasheet */}
          {quickCreate ? (
            <form
              onSubmit={handleQuickCreate}
              className="rounded-lg border border-border-color bg-bg-secondary p-2 space-y-1.5"
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
              {createError && <p className="text-[10px] text-red-500">{createError}</p>}
              <div className="flex gap-1 pt-0.5">
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !slugify(newName)}
                  className="flex-1 rounded bg-accent px-2 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
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

          {/* Divider */}
          <div className="pt-1 border-t border-border-color/50" />

          {/* All datasheets list */}
          {loading && !loaded ? (
            <div className="py-2 pl-2 text-text-secondary animate-pulse">Loading…</div>
          ) : allModels.length === 0 ? (
            <div className="py-2 pl-2">
              <p className="text-text-secondary italic text-[11px] leading-snug">
                No datasheets yet.
              </p>
            </div>
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
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                    active
                      ? 'text-accent font-semibold'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  }`}
                >
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
