'use client';

import { useState, useEffect } from 'react';
import { getDashboardPins, updateDashboardPins } from '@/services/settings';
import { listModels } from '@/services/dynamic-data';
import type { DynamicModel } from '@/services/dynamic-data';
import dynamic from 'next/dynamic';

const DatasheetReportWidget = dynamic(
  () => import('./datasheet-report-widget').then((m) => m.DatasheetReportWidget),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-bg-secondary" /> }
);

export function PinnedReportsSection() {
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadPinsAndModels = async () => {
    setLoading(true);
    try {
      const [pinsRes, modelsList] = await Promise.all([
        getDashboardPins(),
        listModels(),
      ]);
      setPinnedIds(pinsRes.model_ids);
      setModels(modelsList);
    } catch {
      setPinnedIds([]);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPinsAndModels();
  }, []);

  const availableToPin = models.filter((m) => !pinnedIds.includes(m.id));
  const pinnedModels = models.filter((m) => pinnedIds.includes(m.id));

  const handlePin = async (modelId: number) => {
    if (updating || pinnedIds.includes(modelId)) return;
    setUpdating(true);
    try {
      await updateDashboardPins([...pinnedIds, modelId]);
      setPinnedIds((prev) => [...prev, modelId]);
      setPickerOpen(false);
    } catch {
      // keep picker open on error
    } finally {
      setUpdating(false);
    }
  };

  const handleUnpin = async (modelId: number) => {
    if (updating) return;
    setUpdating(true);
    try {
      const next = pinnedIds.filter((id) => id !== modelId);
      await updateDashboardPins(next);
      setPinnedIds(next);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        <h3 className="text-base font-semibold text-text-primary mb-2">Pinned reports</h3>
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-text-primary">Pinned reports</h3>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            disabled={updating || availableToPin.length === 0}
            className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
          >
            Add report
          </button>
          {pickerOpen && availableToPin.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setPickerOpen(false)}
              />
              <ul
                className="absolute right-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded-lg border border-border-color bg-card-bg py-1 shadow-lg"
                role="listbox"
              >
                {availableToPin.map((m) => (
                  <li key={m.id} role="option">
                    <button
                      type="button"
                      onClick={() => handlePin(m.id)}
                      className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                    >
                      {m.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {pinnedIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-color bg-card-bg p-6 text-center">
          <p className="text-sm text-text-secondary mb-3">
            Pin data sheet reports to see them here.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={updating || availableToPin.length === 0}
            className="inline-flex items-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Add report
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pinnedModels.map((m) => (
            <DatasheetReportWidget
              key={m.id}
              modelId={m.id}
              displayName={m.display_name}
              onUnpin={() => handleUnpin(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
