'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { listChannels, type Channel } from '@/services/channels';
import { Save, Loader2, ExternalLink } from 'lucide-react';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
  indiamart: 'IndiaMART',
  india_mart: 'IndiaMART',
};

export default function ChannelsPage() {
  const { current, saveChannels } = useAgentStore(useShallow((s) => ({
    current: s.current,
    saveChannels: s.saveChannels,
  })));

  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listChannels()
      .then((chs) => {
        setAllChannels(chs);
        if (current) {
          setSelectedIds(new Set((current.channelIds ?? []).map(String)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [current?.id]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      await saveChannels(current.id, Array.from(selectedIds));
      setNotice('Channels saved!');
      setTimeout(() => setNotice(null), 2000);
    } catch { /* store handles error */ } finally { setSaving(false); }
  }, [current, selectedIds, saveChannels]);

  if (!current) return null;

  const connectedCount = allChannels.filter((c) => selectedIds.has(c.id)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* LEFT: Channel List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Channels</h2>
            <p className="text-xs text-text-secondary">Select which channels this agent responds on</p>
          </div>
          <Link
            href="/channels"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Manage channels <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {loading && <div className="text-center py-8 text-sm text-text-secondary">Loading channels...</div>}

        {!loading && allChannels.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-border-color">
            <p className="text-sm text-text-secondary mb-2">No channels connected yet</p>
            <Link href="/channels" className="text-sm text-accent hover:underline">
              Connect a channel first
            </Link>
          </div>
        )}

        {!loading && allChannels.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color">
            {allChannels.map((ch) => {
              const on = selectedIds.has(ch.id);
              const label = CHANNEL_LABELS[ch.type] || ch.type;
              return (
                <div key={ch.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{ch.name || label}</span>
                      <span className="text-[10px] rounded-full bg-bg-secondary px-2 py-0.5 text-text-secondary">{label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${ch.isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {ch.leadCount ?? 0} leads
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(ch.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      on
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'
                    }`}
                  >
                    {on ? 'Connected' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Channels
        </button>
      </div>

      {/* RIGHT: Summary */}
      <div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Channels Summary</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-text-secondary">Connected</span><span className="text-text-primary font-medium">{connectedCount}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Available</span><span className="text-text-primary">{allChannels.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
