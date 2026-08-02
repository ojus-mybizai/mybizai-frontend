'use client';

import { useState, useEffect } from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import type { ContactFilters, Priority, RoutingMode } from '@/services/contacts-v2';
import type { Channel as BusinessChannel } from '@/services/channels';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ContactFilters;
  onApply: (filters: ContactFilters) => void;
  teamMembers?: { id: number; name: string }[];
  channelInstances?: BusinessChannel[];
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'hot',    label: '🔥 Hot' },
  { value: 'high',   label: '↑ High' },
  { value: 'medium', label: '— Medium' },
  { value: 'low',    label: '↓ Low' },
];

const ROUTING_MODES: { value: RoutingMode; label: string }[] = [
  { value: 'ai',      label: 'AI (auto-reply)' },
  { value: 'manual',  label: 'Manual (inbox)' },
  { value: 'blocked', label: 'Blocked' },
];

const SOURCES = [
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'meta_ads',  label: 'Meta Ads' },
  { value: 'manual',    label: 'Manual' },
  { value: 'csv',       label: 'CSV Import' },
  { value: 'api',       label: 'API' },
  { value: 'web_form',  label: 'Web Form' },
];

export function ContactFiltersDrawer({ open, onClose, filters, onApply, teamMembers = [], channelInstances = [] }: Props) {
  const { tags, loadTags } = useContactV2Store();
  const [local, setLocal] = useState<ContactFilters>(filters);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      if (tags.length === 0) loadTags();
    }
  }, [open]);

  if (!open) return null;

  function set(field: keyof ContactFilters, value: unknown) {
    setLocal(f => ({ ...f, [field]: value || undefined }));
  }

  function reset() {
    setLocal({ sort_by: 'created_at', sort_dir: 'desc' });
  }

  function apply() {
    onApply(local);
    onClose();
  }

  const tagIds = local.tag_ids ?? [];
  const activeCount = [
    local.priority,
    local.assigned_to_id,
    local.routing_mode,
    local.source,
    local.channel_id,
  ].filter(Boolean).length + tagIds.length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-80 border-l border-border-color bg-card-bg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-accent text-white text-[10px] font-bold px-1.5 py-0.5">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <button onClick={reset} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-bg-secondary">
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Priority
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => set('priority', local.priority === p.value ? null : p.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    local.priority === p.value
                      ? 'border-accent bg-accent text-white'
                      : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Tag
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => {
                  const on = tagIds.includes(t.id);
                  return (
                  <button
                    key={t.id}
                    onClick={() => set('tag_ids', on ? tagIds.filter(x => x !== t.id) : [...tagIds, t.id])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      on
                        ? 'border-transparent text-white'
                        : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                    }`}
                    style={on ? { backgroundColor: t.color ?? '#6366f1' } : {}}
                  >
                    {t.name}
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Routing */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Routing Mode
            </label>
            <div className="space-y-1">
              {ROUTING_MODES.map(r => (
                <button
                  key={r.value}
                  onClick={() => set('routing_mode', local.routing_mode === r.value ? null : r.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    local.routing_mode === r.value
                      ? 'bg-accent/10 text-accent border border-accent/30'
                      : 'hover:bg-bg-secondary text-text-secondary border border-transparent'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Source
            </label>
            <select
              value={local.source ?? ''}
              onChange={e => set('source', e.target.value || null)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">All sources</option>
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Channel (business channel instance) */}
          {channelInstances.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Channel
              </label>
              <select
                value={local.channel_id ?? ''}
                onChange={e => set('channel_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">All channels</option>
                {channelInstances.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>
                ))}
              </select>
            </div>
          )}

          {/* Assigned To */}
          {teamMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                Assigned To
              </label>
              <select
                value={local.assigned_to_id ?? ''}
                onChange={e => set('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Anyone</option>
                <option value="-1">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={local.sort_by ?? 'created_at'}
                onChange={e => set('sort_by', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="created_at">Created</option>
                <option value="name">Name</option>
                <option value="priority">Priority</option>
                <option value="last_message_at">Last Message</option>
              </select>
              <select
                value={local.sort_dir ?? 'desc'}
                onChange={e => set('sort_dir', e.target.value as 'asc' | 'desc')}
                className="px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-color">
          <button
            onClick={apply}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
