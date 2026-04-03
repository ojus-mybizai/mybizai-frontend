'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import type { CustomerFilters } from '@/services/customers';
import { listChannels, type Channel } from '@/services/channels';

interface Props {
  initial: CustomerFilters;
  onApply: (filters: CustomerFilters) => void;
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
};

export function CustomerFilters({ initial, onApply }: Props) {
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: Array<{ role?: string }> } | null);
  const currentUserId = user?.id;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewAllLeads = hasPermission('view_all_leads');
  const [draft, setDraft] = useState<CustomerFilters>(initial);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  const apply = () => onApply({ ...draft, page: 1 });

  const activeCount = [
    draft.search,
    draft.priority,
    draft.source,
    draft.channelId,
    draft.assignedFilter && draft.assignedFilter !== 'all' ? draft.assignedFilter : undefined,
  ].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span className="font-semibold">Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-accent px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-border-color px-4 pb-4 pt-3 grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">Search</label>
            <input
              value={draft.search ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              placeholder="Name, phone, or email"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">Priority</label>
            <select
              value={draft.priority ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, priority: (e.target.value as 'low' | 'medium' | 'high') || undefined }))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">Source</label>
            <select
              value={draft.source ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value || undefined }))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="walk-in">Walk-in</option>
              <option value="ad_campaign">Ad Campaign</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-secondary">Channel</label>
            <select
              value={draft.channelId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, channelId: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All channels</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {CHANNEL_TYPE_LABELS[ch.type] ?? ch.type} · {ch.name}
                </option>
              ))}
            </select>
          </div>
          {canViewAllLeads && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-secondary">Assigned to</label>
              <select
                value={draft.assignedFilter ?? 'all'}
                onChange={(e) => {
                  const v = e.target.value as 'all' | 'unassigned' | 'me';
                  setDraft((d) => ({
                    ...d,
                    assignedFilter: v,
                    assignedToId: v === 'me' && currentUserId != null ? currentUserId : undefined,
                  }));
                }}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                <option value="me" disabled={currentUserId == null}>Me</option>
              </select>
            </div>
          )}
          <div className="md:col-span-6 flex items-center justify-between gap-3">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const cleared: CustomerFilters = {};
                  setDraft(cleared);
                  onApply({ ...cleared, page: 1 });
                }}
                className="text-xs font-semibold text-text-secondary hover:text-red-500 transition-colors"
              >
                Clear all filters
              </button>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => { apply(); setOpen(false); }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
