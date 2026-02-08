'use client';

import { useRef, useEffect, useState } from 'react';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  loading = false,
  error = null,
  emptyMessage = 'No options',
  onRetry,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const displayLabel = selected ? selected.label : '';

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center">
          <input
            id={id}
            type="text"
            value={open ? query : displayLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setQuery('');
              }
              if (e.key === 'Enter' && filtered.length === 1) {
                onChange(filtered[0].value);
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || loading}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="w-full rounded-lg border border-border-color bg-bg-primary py-2.5 pl-3 pr-9 text-base text-text-primary placeholder:text-text-secondary focus:border-text-secondary focus:outline-none disabled:opacity-60"
          />
          <span className="pointer-events-none absolute right-2 text-text-secondary" aria-hidden>
            {loading ? '…' : '▼'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-sm text-red-600">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="text-sm font-medium text-text-primary underline hover:no-underline">
              Retry
            </button>
          )}
        </div>
      )}

      {open && !loading && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-56 w-full overflow-auto rounded-lg border border-border-color bg-bg-primary py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-secondary">{emptyMessage}</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={String(opt.value) === String(value)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="cursor-pointer px-4 py-2.5 text-base text-text-primary hover:bg-bg-secondary focus:bg-bg-secondary"
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
