'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, UserCheck, X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useDebounce } from '@/lib/use-debounce';

interface GlobalSearchItem {
  entity_type: 'lead' | 'contact';
  id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  extra?: string | null;
}

interface GlobalSearchResponse {
  query: string;
  items: GlobalSearchItem[];
  total: number;
}

function highlight(text: string, query: string): string {
  if (!query.trim()) return text;
  return text; // plain — no HTML injection risk
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Fetch results when debounced query changes
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch<GlobalSearchResponse>(`/search/all?q=${encodeURIComponent(q)}&limit=12`)
      .then(data => {
        if (!cancelled) {
          setResults(data.items);
          setOpen(true);
          setActiveIdx(-1);
        }
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard: Cmd/Ctrl+K to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectItem(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const selectItem = (item: GlobalSearchItem) => {
    setOpen(false);
    setQuery('');
    if (item.entity_type === 'lead') {
      router.push(`/leads/${item.id}`);
    } else {
      router.push(`/contacts?highlight=${item.id}`);
    }
  };

  const displayName = (item: GlobalSearchItem) =>
    item.name || item.phone || item.email || `#${item.id}`;

  const subline = (item: GlobalSearchItem) => {
    const parts: string[] = [];
    if (item.phone) parts.push(item.phone);
    if (item.email) parts.push(item.email);
    if (item.company) parts.push(item.company);
    if (item.extra) parts.push(item.extra);
    return parts.slice(0, 2).join(' · ');
  };

  const leads    = results.filter(r => r.entity_type === 'lead');
  const contacts = results.filter(r => r.entity_type === 'contact');

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      {/* Input */}
      <div className="relative flex items-center">
        {loading
          ? <Loader2 className="absolute left-2.5 h-3.5 w-3.5 text-text-secondary animate-spin pointer-events-none" />
          : <Search className="absolute left-2.5 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) setOpen(false); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search leads & contacts…"
          aria-label="Global search"
          className="h-8 w-full rounded-full border border-border-color bg-bg-secondary pl-8 pr-7 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 text-text-secondary hover:text-text-primary"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border-color bg-bg-primary shadow-xl overflow-hidden max-h-80 overflow-y-auto">

          {leads.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Leads
              </p>
              {leads.map((item, i) => {
                const globalIdx = i;
                return (
                  <button
                    key={`lead-${item.id}`}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    onClick={() => selectItem(item)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                      activeIdx === globalIdx ? 'bg-accent/10' : 'hover:bg-bg-secondary'
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                      {(item.name || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary truncate">{displayName(item)}</p>
                      {subline(item) && (
                        <p className="text-[11px] text-text-secondary truncate">{subline(item)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {contacts.length > 0 && (
            <div className={leads.length > 0 ? 'border-t border-border-color' : ''}>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1.5">
                <UserCheck className="h-3 w-3" /> Contacts
              </p>
              {contacts.map((item, i) => {
                const globalIdx = leads.length + i;
                return (
                  <button
                    key={`contact-${item.id}`}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    onClick={() => selectItem(item)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                      activeIdx === globalIdx ? 'bg-accent/10' : 'hover:bg-bg-secondary'
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-semibold">
                      {(item.name || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary truncate">{displayName(item)}</p>
                      {subline(item) && (
                        <p className="text-[11px] text-text-secondary truncate">{subline(item)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="border-t border-border-color px-3 py-1.5 flex items-center gap-2 text-[10px] text-text-secondary">
            <kbd className="rounded border border-border-color px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> navigate
            <kbd className="rounded border border-border-color px-1 py-0.5 font-mono text-[9px]">↵</kbd> open
            <kbd className="rounded border border-border-color px-1 py-0.5 font-mono text-[9px]">Esc</kbd> close
          </div>
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border-color bg-bg-primary shadow-xl px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">No results for <span className="font-medium text-text-primary">"{query}"</span></p>
        </div>
      )}
    </div>
  );
}
