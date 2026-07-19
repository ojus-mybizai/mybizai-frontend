'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getProcessForecast, type Forecast, type ProcessEntry } from '@/services/processes';
import {
  Money, Pill, Icon, SectionHeader, EmptyState, formatCurrency, formatDateShort,
} from './design-system';

interface Props {
  processId: number;
  entries: ProcessEntry[];
}

const BUCKET_ORDER = ['Overdue', 'This Week', 'This Month', 'Next Quarter', 'Later', 'No date'];
const BUCKET_COLOR: Record<string, string> = {
  'Overdue':      '#EF4444',
  'This Week':    '#F59E0B',
  'This Month':   '#3B82F6',
  'Next Quarter': '#8B5CF6',
  'Later':        '#6B7280',
  'No date':      '#94A3B8',
};

export default function ForecastView({ processId, entries }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const entriesById = useMemo(() => Object.fromEntries(entries.map(e => [e.id, e])), [entries]);

  useEffect(() => {
    setLoading(true);
    getProcessForecast(processId).then(setForecast).catch(() => {}).finally(() => setLoading(false));
  }, [processId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 rounded-xl bg-bg-secondary animate-pulse" />
        <div className="h-12 rounded-xl bg-bg-secondary animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-bg-secondary animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!forecast || forecast.raw_total === 0) {
    return (
      <EmptyState
        icon="🔮"
        title="No forecast data yet"
        body="Add expected value and close date to entries to start seeing your forecast."
      />
    );
  }

  const sorted = [...forecast.buckets].sort((a, b) =>
    BUCKET_ORDER.indexOf(a.label) - BUCKET_ORDER.indexOf(b.label));

  // Stacked bar segments (skip zero buckets so the bar reads cleanly)
  const segments = sorted.filter(b => b.raw_value > 0);
  const segTotal = segments.reduce((s, b) => s + b.raw_value, 0) || 1;

  return (
    <div className="space-y-4">
      {/* Totals card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Open pipeline</p>
            <Icon.funnel size={14} />
          </div>
          <Money value={forecast.raw_total} compact size="2xl" />
        </div>
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Weighted forecast</p>
            <Icon.trend size={14} className="text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCurrency(forecast.weighted_total, true)}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Σ expected value × stage win probability
          </p>
        </div>
      </div>

      {/* Distribution stacked bar */}
      {segments.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <SectionHeader title="When will it close?" sub="Distribution of open pipeline by expected close date" />
          <div className="h-6 w-full rounded-md overflow-hidden flex bg-bg-secondary">
            {segments.map(b => (
              <div
                key={b.label}
                title={`${b.label} · ${formatCurrency(b.raw_value, true)} · ${b.count} deal${b.count !== 1 ? 's' : ''}`}
                style={{ width: `${(b.raw_value / segTotal) * 100}%`, background: BUCKET_COLOR[b.label] }}
                className="transition-card hover:brightness-110"
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {segments.map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLOR[b.label] }} />
                <span className="text-text-secondary">{b.label}</span>
                <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(b.raw_value, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bucket detail lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {sorted.filter(b => b.count > 0).map(bucket => {
          const color = BUCKET_COLOR[bucket.label];
          const overdue = bucket.label === 'Overdue';
          return (
            <div key={bucket.label}
              className={`rounded-xl border bg-card-bg overflow-hidden
                ${overdue ? 'border-red-300 dark:border-red-800/70' : 'border-border-color'}`}
            >
              <div className="h-1" style={{ background: color }} />
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-sm font-semibold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
                    {bucket.label}
                  </h3>
                  <Pill tone={overdue ? 'danger' : 'neutral'} size="xs">{bucket.count}</Pill>
                </div>
                <div className="text-lg font-bold text-text-primary tabular-nums">
                  {formatCurrency(bucket.raw_value, true)}
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mb-2">
                  Weighted {formatCurrency(bucket.weighted_value, true)}
                </p>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {bucket.entry_ids.slice(0, 12).map(id => {
                    const e = entriesById[id];
                    if (!e) return null;
                    return (
                      <div key={id} className="rounded-md border border-border-color bg-bg-secondary/60 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {e.title || e.entity_name}
                          </p>
                          {e.expected_value != null && (
                            <Money value={e.expected_value} compact size="sm" tone="success" />
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-secondary">
                          <span className="truncate">{e.current_stage_name}</span>
                          {e.expected_close_date && <span>· {formatDateShort(e.expected_close_date)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {bucket.entry_ids.length > 12 && (
                    <p className="text-[10px] text-text-secondary italic pt-1">+{bucket.entry_ids.length - 12} more…</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
