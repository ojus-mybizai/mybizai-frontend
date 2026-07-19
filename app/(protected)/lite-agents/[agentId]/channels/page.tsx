'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Radio, Save, CheckCircle } from 'lucide-react';
import { useLiteAgentStore } from '@/lib/lite-agent-store';
import { useShallow } from 'zustand/react/shallow';
import { apiFetch } from '@/lib/api-client';

interface ChannelInfo {
  id: number;
  type: string;
  name: string;
  is_connected: boolean;
  agent_id: number | null;
  lead_count: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  messenger: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  indiamart: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  webchat: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function LiteAgentChannelsPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const { current, saveChannels } = useLiteAgentStore(
    useShallow((s) => ({ current: s.current, saveChannels: s.saveChannels })),
  );

  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<ChannelInfo[]>('/channels/');
        setChannels(data || []);
        if (current) {
          setSelected(new Set(current.channelIds.map(Number)));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [current]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveChannels(agentId, Array.from(selected).map(String));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-text-secondary">Loading channels...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="text-sm font-semibold text-text-primary mb-1">Connect Channels</h2>
        <p className="text-xs text-text-secondary mb-4">
          Select which channels this Lite Agent should respond on.
        </p>

        {channels.length === 0 ? (
          <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center">
            <Radio className="mx-auto h-8 w-8 text-text-secondary/40 mb-2" />
            <p className="text-sm text-text-secondary">No channels configured yet.</p>
            <p className="text-xs text-text-secondary mt-1">Go to Channels to connect WhatsApp, Instagram, etc.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => {
              const isSelected = selected.has(ch.id);
              const linkedToOther = ch.agent_id !== null && ch.agent_id !== Number(agentId) && !isSelected;

              return (
                <button
                  key={ch.id}
                  onClick={() => !linkedToOther && toggle(ch.id)}
                  disabled={linkedToOther}
                  className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/5'
                      : linkedToOther
                        ? 'border-border-color bg-bg-secondary opacity-50 cursor-not-allowed'
                        : 'border-border-color bg-card-bg hover:border-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${CHANNEL_COLORS[ch.type] || 'bg-gray-100 text-gray-700'}`}>
                      {ch.type}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{ch.name}</span>
                    {linkedToOther && (
                      <span className="text-[10px] text-text-secondary">(linked to another agent)</span>
                    )}
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary'
                      : 'border-border-color'
                  }`} />
                </button>
              );
            })}
          </div>
        )}

        {channels.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saved ? (
              <><CheckCircle className="h-4 w-4" /> Saved</>
            ) : (
              <><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Channels'}</>
            )}
          </button>
        )}
      </div>

      <div>
        <div className="rounded-xl border border-border-color bg-card-bg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Channel Summary</h3>
          <p className="text-2xl font-bold text-brand-primary">{selected.size}</p>
          <p className="text-xs text-text-secondary">channels connected</p>
        </div>
      </div>
    </div>
  );
}
