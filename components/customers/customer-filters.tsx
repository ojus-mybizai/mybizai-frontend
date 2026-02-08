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
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const isExecutive = role === 'executive'; // EXECUTIVE sees only assigned leads; no filter UI
  const [draft, setDraft] = useState<CustomerFilters>(initial);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    listChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  const apply = () => onApply({ ...draft, page: 1 });

  return (
    <div className="grid gap-3 rounded-xl border border-border-color bg-card-bg p-4 md:grid-cols-6">
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
        <label className="text-sm font-medium text-text-secondary">Status</label>
        <select
          value={draft.status ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, status: (e.target.value as 'new' | 'contacted' | 'qualified' | 'lost' | 'won') || undefined }))}
          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
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
      {!isExecutive && (
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
      <div className="md:col-span-6 flex justify-end">
        <button
          type="button"
          onClick={apply}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Apply filters
        </button>
      </div>
    </div>
  );
}
