'use client';

import type { LeadStats } from '@/services/customers';
import type { CustomerFilters } from '@/services/customers';

interface LeadStatsCardProps {
  stats: LeadStats | null;
  onSegmentClick?: (filter: Partial<CustomerFilters>) => void;
  className?: string;
}

function StatRow({
  label,
  count,
  total,
  colorClass,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  onClick?: () => void;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate capitalize text-text-primary">{label}</span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${colorClass}`}>
        {count}
      </span>
      {total > 0 && (
        <span className="shrink-0 w-10 text-right text-sm text-text-secondary tabular-nums">{pct}%</span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card-bg"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
      {content}
    </div>
  );
}

export function LeadStatsCard({ stats, onSegmentClick, className = '' }: LeadStatsCardProps) {
  if (!stats) {
    return (
      <div className={`rounded-xl border border-border-color bg-card-bg p-5 ${className}`}>
        <div className="text-base text-text-secondary">Loading statistics…</div>
      </div>
    );
  }

  const total = stats.total_leads;
  const statusColors: Record<string, string> = {
    new: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200',
    contacted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    won: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    lost: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-200',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    high: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  };

  const sourceEntries = Object.entries(stats.by_source).filter(([, c]) => c > 0);
  const statusEntries = Object.entries(stats.by_status).filter(([, c]) => c > 0);
  const priorityEntries = Object.entries(stats.by_priority).filter(([, c]) => c > 0);

  return (
    <div className={`overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm ${className}`}>
      {/* Header + total */}
      <div className="border-b border-border-color bg-bg-secondary/50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Lead statistics</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-text-primary">{total}</span>
          <span className="text-base font-medium text-text-secondary">total leads</span>
        </div>
      </div>

      {/* Table-style stats */}
      <div className="grid gap-0 md:grid-cols-2">
        {/* By Status */}
        <div className="border-b md:border-b-0 md:border-r border-border-color">
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            By status
          </div>
          <div className="divide-y divide-border-color/60 px-2 pb-2">
            {statusEntries.length > 0 ? (
              statusEntries.map(([status, count]) => (
                <StatRow
                  key={status}
                  label={status}
                  count={count}
                  total={total}
                  colorClass={statusColors[status] ?? 'bg-gray-100 text-gray-800'}
                  onClick={
                    onSegmentClick
                      ? () => onSegmentClick({ status: status as CustomerFilters['status'], page: 1 })
                      : undefined
                  }
                />
              ))
            ) : (
              <div className="px-2.5 py-3 text-sm text-text-secondary">No data</div>
            )}
          </div>
        </div>

        {/* By Priority */}
        <div>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            By priority
          </div>
          <div className="divide-y divide-border-color/60 px-2 pb-2">
            {priorityEntries.length > 0 ? (
              priorityEntries.map(([priority, count]) => (
                <StatRow
                  key={priority}
                  label={priority}
                  count={count}
                  total={total}
                  colorClass={priorityColors[priority] ?? 'bg-gray-100 text-gray-800'}
                  onClick={
                    onSegmentClick
                      ? () => onSegmentClick({ priority: priority as CustomerFilters['priority'], page: 1 })
                      : undefined
                  }
                />
              ))
            ) : (
              <div className="px-2.5 py-3 text-sm text-text-secondary">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* By Source */}
      {sourceEntries.length > 0 && (
        <div className="border-t border-border-color bg-bg-secondary/30 px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            By source
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceEntries.map(([source, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const label = `${source.replace('_', ' ')} · ${count}${total > 0 ? ` (${pct}%)` : ''}`;
              if (onSegmentClick) {
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => onSegmentClick({ source, page: 1 })}
                    className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 transition-colors hover:border-green-300 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200 dark:hover:bg-green-900/50"
                    title={`Filter by ${source}`}
                  >
                    {label}
                  </button>
                );
              }
              return (
                <span
                  key={source}
                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
