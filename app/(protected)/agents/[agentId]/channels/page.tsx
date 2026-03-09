'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChannelCard } from '@/components/agents/channel-card';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { FacebookSDKLoader } from '@/components/integrations/FacebookSDKLoader';
import { MetaConnectButton } from '@/components/integrations/MetaConnectButton';
import { useAgentStore } from '@/lib/agent-store';
import { deleteChannel, listChannels, type Channel, type MetaChannelType } from '@/services/channels';

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
};

const CHANNEL_CONFIG: Array<{ type: MetaChannelType; name: string; description: string }> = [
  { type: 'whatsapp', name: 'WhatsApp', description: 'Connect to WhatsApp to serve customers in real time.' },
  { type: 'instagram', name: 'Instagram', description: 'Respond to Instagram DMs and story mentions.' },
  { type: 'messenger', name: 'Facebook Messenger', description: 'Handle messages from your Facebook business page.' },
];


export default function AgentChannelsPage() {
  const { current, loading, saveChannels } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
    saveChannels: s.saveChannels,
  }));

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [initialisedFromAgent, setInitialisedFromAgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      setChannelsError(null);
      const data = await listChannels();
      setChannels(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load channels';
      setChannelsError(msg);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (current && !initialisedFromAgent) {
      setSelection(current.channelIds ?? []);
      setInitialisedFromAgent(true);
    }
  }, [current, initialisedFromAgent]);

  const toggleChannel = async (channelId: string, next: boolean) => {
    if (!current) return;
    const nextSelection = next
      ? [...selection, channelId]
      : selection.filter((id) => id !== channelId);
    setSelection(nextSelection);
    setMessage(null);
    setChannelsError(null);
    setSaving(true);
    try {
      await saveChannels(current.id, nextSelection);
      setMessage('Saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update channels';
      setChannelsError(msg);
      setSelection(selection);
    } finally {
      setSaving(false);
    }
  };

  const refreshChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      setChannelsError(null);
      const data = await listChannels();
      setChannels(data);
      setSelection((prev) => {
        const next = new Set(prev);
        data.forEach((ch) => next.add(ch.id));
        return prev.filter((id) => data.some((c) => c.id === id));
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh channels';
      setChannelsError(msg);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  const handleRemoveChannel = async (channelId: string) => {
    if (!confirm('Remove this channel from your business? This will unlink it from all agents.')) return;
    setRemovingId(channelId);
    try {
      await deleteChannel(channelId);
      setSelection((prev) => prev.filter((id) => id !== channelId));
      await loadChannels();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove channel';
      setChannelsError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  if (!current && loading) {
    return <LoadingSkeleton count={2} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  const typeCount: Record<string, number> = {};
  channels.forEach((ch) => {
    typeCount[ch.type] = (typeCount[ch.type] ?? 0) + 1;
  });
  const getDisplayName = (ch: Channel, indexInList: number) => {
    const base = ch.name?.trim() || CHANNEL_TYPE_LABELS[ch.type] || ch.type;
    const count = typeCount[ch.type] ?? 0;
    if (count > 1) {
      const sameTypeIndex = channels.slice(0, indexInList + 1).filter((c) => c.type === ch.type).length;
      return `${base} (${sameTypeIndex})`;
    }
    return base;
  };

  return (
    <div className="space-y-6">
      <FacebookSDKLoader />

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      {channelsError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {channelsError}
        </div>
      )}

      <p className="text-base text-text-secondary">
        Toggle each channel to assign or unassign it to this agent. To connect new channels to your business (and capture leads), use{' '}
        <Link href="/channels" className="font-semibold text-accent hover:underline">
          Channels
        </Link>{' '}
        first, then assign them here. <span className="font-medium">Changes save when you toggle.</span>
      </p>

      {/* List each channel with its own connect/disconnect toggle */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Your channels</h3>
        {channelsLoading && channels.length === 0 ? (
          <LoadingSkeleton count={2} />
        ) : channels.length === 0 ? (
          <p className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
            No channels yet. Add one below.
          </p>
        ) : (
          <ul className="space-y-3">
            {channels.map((ch, indexInList) => {
              const displayName = getDisplayName(ch, indexInList);
              const connected = selection.includes(ch.id);
              return (
                <li key={ch.id} className="flex items-center gap-3 rounded-xl border border-border-color bg-card-bg p-3">
                  <div className="min-w-0 flex-1">
                    <ChannelCard
                      name={displayName}
                      description={`${CHANNEL_TYPE_LABELS[ch.type] || ch.type} · ${connected ? 'Used by this agent' : 'Not used by this agent'}`}
                      connected={connected}
                      disabled={saving}
                      onToggle={(next) => void toggleChannel(ch.id, next)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveChannel(ch.id)}
                    disabled={removingId === ch.id}
                    className="shrink-0 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-secondary hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  >
                    {removingId === ch.id ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add new channel */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Add channel</h3>
        <p className="text-sm text-text-secondary">
          Connect new channels in <Link href="/channels" className="font-semibold text-accent hover:underline">Channels</Link>, or add below:
        </p>
        <div className="flex flex-wrap gap-3">
          {CHANNEL_CONFIG.map(({ type, name }) => (
            <MetaConnectButton key={type} channel={type} onConnected={refreshChannels} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={refreshChannels}
          disabled={channelsLoading}
          className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:border-accent disabled:opacity-50"
        >
          {channelsLoading ? 'Refreshing…' : 'Refresh channels'}
        </button>
      </div>
    </div>
  );
}

