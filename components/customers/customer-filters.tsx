'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import type { CustomerFilters } from '@/services/customers';
import { listChannels, type Channel } from '@/services/channels';

interface Props {
  initial: CustomerFilters;
  onApply: (filters: CustomerFilters) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
};

export function CustomerFilters({ initial, onApply, isOpen, onClose }: Props) {
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: Array<{ role?: string }> } | null);
  const currentUserId = user?.id;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewAllLeads = hasPermission('view_all_leads');
  const [draft, setDraft] = useState<CustomerFilters>(initial);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    listChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  // Sync draft from initial whenever drawer opens
  useEffect(() => {
    if (isOpen) setDraft(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleApply = () => {
    onApply({ ...draft, page: 1 });
    onClose();
  };

  const handleClear = () => {
    const cleared: CustomerFilters = {};
    setDraft(cleared);
    onApply({ ...cleared, page: 1 });
    onClose();
  };

  const activeCount = [
    draft.search,
    draft.priority,
    draft.source,
    draft.channelId,
    draft.assignedFilter && draft.assignedFilter !== 'all' ? draft.assignedFilter : undefined,
  ].filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-96 bg-card-bg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <span className="text-base font-semibold text-text-primary">Filters</span>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                {activeCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Close filters"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={draft.search ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value || undefined }))}
                placeholder="Name, phone, or email"
                className="w-full rounded-lg border border-border-color bg-bg-primary pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
              />
            </div>
          </div>

          {/* Priority pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Priority</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: undefined, label: 'All' },
                { value: 'high' as const, label: 'High' },
                { value: 'medium' as const, label: 'Medium' },
                { value: 'low' as const, label: 'Low' },
              ] as const).map((opt) => {
                const isActive = (draft.priority ?? undefined) === opt.value;
                const colorCls =
                  opt.value === 'high'
                    ? isActive
                      ? 'bg-red-500 text-white border-red-500'
                      : 'border-border-color text-text-primary hover:border-red-400 hover:text-red-600'
                    : opt.value === 'medium'
                    ? isActive
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-border-color text-text-primary hover:border-amber-400 hover:text-amber-600'
                    : opt.value === 'low'
                    ? isActive
                      ? 'bg-gray-500 text-white border-gray-500'
                      : 'border-border-color text-text-primary hover:border-gray-400 hover:text-gray-600'
                    : isActive
                    ? 'bg-accent text-white border-accent'
                    : 'border-border-color text-text-primary hover:border-accent/60 hover:text-accent';
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, priority: opt.value }))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all ${colorCls}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Source</label>
            <select
              value={draft.source ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value || undefined }))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            >
              <option value="">All sources</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="walk-in">Walk-in</option>
              <option value="ad_campaign">Ad Campaign</option>
            </select>
          </div>

          {/* Channel select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Channel</label>
            <select
              value={draft.channelId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, channelId: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            >
              <option value="">All channels</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {CHANNEL_TYPE_LABELS[ch.type] ?? ch.type} · {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned To pills */}
          {canViewAllLeads && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Assigned To</label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'all' as const, label: 'All' },
                  { value: 'unassigned' as const, label: 'Unassigned' },
                  { value: 'me' as const, label: 'Me', disabled: currentUserId == null },
                ] as const).map((opt) => {
                  const current = draft.assignedFilter ?? 'all';
                  const isActive = current === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={'disabled' in opt && opt.disabled}
                      onClick={() => {
                        const v = opt.value;
                        setDraft((d) => ({
                          ...d,
                          assignedFilter: v,
                          assignedToId: v === 'me' && currentUserId != null ? currentUserId : undefined,
                        }));
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        isActive
                          ? 'bg-accent text-white border-accent'
                          : 'border-border-color text-text-primary hover:border-accent/60 hover:bg-bg-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-border-color px-5 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:text-red-500 hover:bg-bg-secondary transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
