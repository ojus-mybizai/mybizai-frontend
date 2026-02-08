'use client';

import { useEffect } from 'react';
import ProtectedShell from '@/components/protected-shell';
import { useCatalogStore } from '@/lib/catalog-store';

export default function CatalogStatsPage() {
  const { stats, loadStats } = useCatalogStore((s) => ({
    stats: s.stats,
    loadStats: s.loadStats,
  }));

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (!stats) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-5xl rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm text-text-secondary">Loading stats…</div>
        </div>
      </ProtectedShell>
    );
  }

  const availabilityData = [
    { label: 'Available', value: stats.availability.available ?? 0, color: 'bg-emerald-500' },
    { label: 'Out of stock', value: stats.availability.out_of_stock ?? 0, color: 'bg-amber-500' },
    { label: 'Discontinued', value: stats.availability.discontinued ?? 0, color: 'bg-slate-500' },
  ];

  const maxAvail = Math.max(...availabilityData.map((d) => d.value), 1);

  return (
    <ProtectedShell>
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Catalog stats</h2>
              <p className="text-sm text-text-secondary">Summary of items, types, and availability.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <StatCard title="Total items" value={stats.total} />
            <StatCard title="Products" value={stats.products} />
            <StatCard title="Services" value={stats.services} />
            <StatCard
              title="Avg price"
              value={stats.averagePrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              prefix="₹"
            />
          </div>

          <div className="rounded-2xl border border-border-color bg-card-bg p-4">
            <div className="mb-3 text-sm font-semibold text-text-primary">Availability</div>
            <div className="space-y-2">
              {availabilityData.map((entry) => (
                <div key={entry.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{entry.label}</span>
                    <span>{entry.value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                    <div
                      className={`h-full ${entry.color}`}
                      style={{ width: `${(entry.value / maxAvail) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </ProtectedShell>
  );
}

function StatCard({ title, value, prefix }: { title: string; value: string | number; prefix?: string }) {
  return (
    <div className="rounded-2xl border border-border-color bg-card-bg px-4 py-3">
      <div className="text-xs font-medium text-text-secondary">{title}</div>
      <div className="text-xl font-semibold text-text-primary">
        {prefix}
        {value}
      </div>
    </div>
  );
}
