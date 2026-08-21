'use client';

import React from 'react';
import type { Member } from '@/services/members';
import type { CardDensity } from './process-card';
import { Icon, formatCurrency } from './design-system';

export type FilterState = {
  search: string;
  assigneeId: number | 'all' | 'unassigned';
  priority: 'all' | 'high' | 'medium' | 'low';
  stuckOnly: boolean;
  minValue: number | null;
  maxValue: number | null;
};

export const DEFAULT_FILTERS: FilterState = {
  search: '', assigneeId: 'all', priority: 'all',
  stuckOnly: false, minValue: null, maxValue: null,
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  employees: Member[];
  density: CardDensity;
  onDensityChange: (d: CardDensity) => void;
  selectionMode: boolean;
  onSelectionModeToggle: () => void;
  selectedCount: number;
  resultCount: number;
  totalCount: number;
  totalValue: number;
}

export default function FilterBar({
  filters, onChange, employees,
  density, onDensityChange,
  selectionMode, onSelectionModeToggle, selectedCount,
  resultCount, totalCount, totalValue,
}: Props) {
  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.assigneeId !== 'all' ? 1 : 0) +
    (filters.priority !== 'all' ? 1 : 0) +
    (filters.stuckOnly ? 1 : 0);

  const filtered = resultCount !== totalCount;

  return (
    <div className="rounded-2xl border border-border-color bg-card-bg overflow-hidden">
      {/* Row 1 — controls. Grouped into 3 zones: primary / state filters / view */}
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
        {/* ─ Primary: search + assignee */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"><Icon.search size={14} /></span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Search…"
              className="pl-8 pr-3 h-8 text-[13px] rounded-lg border border-border-color bg-bg-primary text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent w-48"
            />
          </div>
          <select
            value={String(filters.assigneeId)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...filters, assigneeId: v === 'all' ? 'all' : v === 'unassigned' ? 'unassigned' : Number(v) });
            }}
            className="h-8 px-2.5 text-[13px] rounded-lg border border-border-color bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent max-w-[140px]"
          >
            <option value="all">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {/* Filter compares to entry.assigned_member_id — key on the Member id. */}
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {/* divider */}
        <span className="h-5 w-px bg-border-color hidden sm:block" />

        {/* ─ State filters: priority + stuck */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-border-color overflow-hidden h-8">
            {(['all','high','medium','low'] as const).map(p => (
              <button
                key={p}
                onClick={() => onChange({ ...filters, priority: p })}
                className={`px-2.5 h-full text-xs font-medium capitalize transition-quick inline-flex items-center gap-1
                  ${filters.priority === p ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
                title={p === 'all' ? 'Any priority' : `${p} priority`}
              >
                {p !== 'all' && (
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                )}
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>

          <button
            onClick={() => onChange({ ...filters, stuckOnly: !filters.stuckOnly })}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-lg border transition-quick
              ${filters.stuckOnly
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700'
                : 'bg-bg-primary text-text-secondary border-border-color hover:bg-bg-secondary'}`}
            title="Show only entries past warn/SLA threshold"
          >
            <Icon.alert size={12} /> Stuck
          </button>

          {activeCount > 0 && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="h-8 px-2 text-xs font-medium text-accent hover:underline"
            >
              Clear ({activeCount})
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* ─ View: density + select */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-border-color overflow-hidden h-8">
            <button onClick={() => onDensityChange('compact')}
              className={`px-2 h-full transition-quick ${density === 'compact' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
              title="Compact rows"
              aria-pressed={density === 'compact'}
            >
              <Icon.list size={13} />
            </button>
            <button onClick={() => onDensityChange('standard')}
              className={`px-2 h-full border-l border-border-color transition-quick ${density === 'standard' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
              title="Detailed cards"
              aria-pressed={density === 'standard'}
            >
              <Icon.grid size={13} />
            </button>
          </div>

          <button
            onClick={onSelectionModeToggle}
            className={`h-8 px-2.5 text-xs font-medium rounded-lg border transition-quick
              ${selectionMode ? 'bg-accent text-white border-accent' : 'bg-bg-primary text-text-secondary border-border-color hover:bg-bg-secondary'}`}
          >
            {selectionMode
              ? (selectedCount > 0 ? `${selectedCount} selected` : 'Selecting')
              : 'Select'}
          </button>
        </div>
      </div>

      {/* Row 2 — quiet result counter strip. Only shows on filter activity or value. */}
      {(filtered || totalValue > 0) && (
        <div className="px-3.5 py-2 border-t border-border-color bg-bg-secondary/30 text-xs text-text-secondary flex items-center gap-3">
          <span>
            Showing{' '}
            <span className="tabular-nums font-semibold text-text-primary">{resultCount}</span>
            {filtered && <> of <span className="tabular-nums">{totalCount}</span></>}
            {' '}{totalCount === 1 ? 'entry' : 'entries'}
          </span>
          {totalValue > 0 && (
            <>
              <span className="text-text-secondary/40">·</span>
              <span>
                Value{' '}
                <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalValue, true)}
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
