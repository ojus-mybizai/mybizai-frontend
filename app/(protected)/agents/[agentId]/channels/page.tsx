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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listChannels()
      .then((chs) => {
        setAllChannels(chs);
        if (current) {
          // Derive selected from channels that have this agent's ID
          const linked = chs
            .filter((ch) => ch.agentId != null && String(ch.agentId) === String(current.id))
            .map((ch) => ch.id);
          setSelectedIds(linked);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [current?.id]);

  const toggleChannel = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      // Check if this channel is already linked to another agent
      const ch = allChannels.find((c) => c.id === id);
      if (ch && ch.agentId && current && String(ch.agentId) !== current.id) {
        setNotice('This channel is already linked to another agent');
        setTimeout(() => setNotice(null), 3000);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveChannels(current.id, selectedIds);
      setNotice('Channels saved!');
      setTimeout(() => setNotice(null), 2000);
    } catch (err) {
      setNotice(`Failed to save: ${(err as Error).message}`);
    } finally { setSaving(false); }
  }, [current, selectedIds, saveChannels]);

  if (!current) return null;

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
              const on = selectedIds.includes(ch.id);
              const label = CHANNEL_LABELS[ch.type] || ch.type;
              const linkedToOther = ch.agentId != null && current && String(ch.agentId) !== String(current.id);
              return (
                <div key={ch.id} className={`flex items-center justify-between px-4 py-3 ${linkedToOther ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{ch.name || label}</span>
                      <span className="text-[10px] rounded-full bg-bg-secondary px-2 py-0.5 text-text-secondary">{label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${ch.isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {linkedToOther ? `Linked to another agent (ID: ${ch.agentId})` : `${ch.leadCount ?? 0} leads`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    disabled={!!linkedToOther}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      on
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'
                    } ${linkedToOther ? 'cursor-not-allowed' : ''}`}
                  >
                    {on ? 'Selected' : 'Select'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">{notice}</div>}

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
            <div className="flex justify-between"><span className="text-text-secondary">Connected</span><span className="text-text-primary font-medium">{selectedIds.length}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Available</span><span className="text-text-primary">{allChannels.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
