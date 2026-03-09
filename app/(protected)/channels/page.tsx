'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ModuleGuard from '@/components/module-guard';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { FacebookSDKLoader } from '@/components/integrations/FacebookSDKLoader';
import { MetaConnectButton } from '@/components/integrations/MetaConnectButton';
import { createChannel, deleteChannel, listChannels, type Channel, type MetaChannelType } from '@/services/channels';

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
  indiamart: 'IndiaMART',
  india_mart: 'IndiaMART',
};

const CHANNEL_CONFIG: Array<{ type: MetaChannelType; name: string; description: string }> = [
  { type: 'whatsapp', name: 'WhatsApp', description: 'Connect to WhatsApp to capture leads and serve customers in real time.' },
  { type: 'instagram', name: 'Instagram', description: 'Respond to Instagram DMs and story mentions.' },
  { type: 'messenger', name: 'Facebook Messenger', description: 'Handle messages from your Facebook business page.' },
];

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showIndiaMARTForm, setShowIndiaMARTForm] = useState(false);
  const [indiamartName, setIndiamartName] = useState('');
  const [indiamartSellerId, setIndiamartSellerId] = useState('');
  const [indiamartSubmitting, setIndiamartSubmitting] = useState(false);
  const [indiamartError, setIndiamartError] = useState<string | null>(null);

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

  const handleRemoveChannel = async (channelId: string) => {
    if (!confirm('Remove this channel from your business?')) return;
    setRemovingId(channelId);
    try {
      await deleteChannel(channelId);
      await loadChannels();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove channel';
      setChannelsError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  const handleConnectIndiaMART = async () => {
    const name = indiamartName.trim() || 'IndiaMART';
    const sellerId = indiamartSellerId.trim();
    if (!sellerId) {
      setIndiamartError('Seller ID is required');
      return;
    }
    setIndiamartSubmitting(true);
    setIndiamartError(null);
    try {
      await createChannel({ type: 'indiamart', name, config: { seller_id: sellerId } });
      setShowIndiaMARTForm(false);
      setIndiamartName('');
      setIndiamartSellerId('');
      await loadChannels();
    } catch (err) {
      setIndiamartError(err instanceof Error ? err.message : 'Failed to connect IndiaMART');
    } finally {
      setIndiamartSubmitting(false);
    }
  };

  const refreshChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      setChannelsError(null);
      const data = await listChannels();
      setChannels(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh channels';
      setChannelsError(msg);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

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
    <ModuleGuard module="lms">
      <div className="w-full max-w-full space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
                Channels
              </h2>
              <p className="mt-0.5 text-base text-text-secondary">
                Connect WhatsApp, Instagram, and Messenger to capture leads. Messages on connected channels create leads automatically, even without an agent.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
            <div className="font-semibold text-text-primary mb-1 text-base">Channel management</div>
            <div>
              Channels are managed here under the Lead Management System. If Business Agents is enabled, you can deploy agents onto connected channels from{' '}
              <Link href="/agents" className="text-accent hover:underline">
                Business Agents
              </Link>
              .
            </div>
          </div>

          <FacebookSDKLoader />

          {channelsError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {channelsError}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-text-primary">Your channels</h3>
              <button
                type="button"
                onClick={refreshChannels}
                disabled={channelsLoading}
                className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:border-accent disabled:opacity-50"
              >
                {channelsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            {channelsLoading && channels.length === 0 ? (
              <LoadingSkeleton count={2} />
            ) : channels.length === 0 ? (
              <p className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
                No channels yet. Connect one below to start capturing leads.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-color bg-bg-secondary/50">
                        <th className="px-4 py-3 font-semibold text-text-primary">Name</th>
                        <th className="px-4 py-3 font-semibold text-text-primary">Type</th>
                        <th className="px-4 py-3 font-semibold text-text-primary">Status</th>
                        <th className="px-4 py-3 font-semibold text-text-primary">Leads</th>
                        <th className="px-4 py-3 font-semibold text-text-primary text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch, indexInList) => {
                        const displayName = getDisplayName(ch, indexInList);
                        const typeLabel = CHANNEL_TYPE_LABELS[ch.type] || ch.type;
                        const leadCount = ch.leadCount ?? 0;
                        return (
                          <tr key={ch.id} className="border-b border-border-color last:border-b-0">
                            <td className="px-4 py-3 font-medium text-text-primary">{displayName}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full border border-border-color bg-bg-secondary px-2.5 py-0.5 text-sm text-text-secondary">
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${
                                  ch.isConnected
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    ch.isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                {ch.isConnected ? 'Connected' : 'Not connected'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Link
                                  href={`/customers?channel_id=${ch.id}`}
                                  className="rounded border border-border-color px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                                >
                                  View leads
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChannel(ch.id)}
                                  disabled={removingId === ch.id}
                                  className="rounded border border-border-color px-3 py-2 text-sm font-medium text-text-secondary hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                                >
                                  {removingId === ch.id ? 'Removing…' : 'Remove'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold text-text-primary">Connect new channel</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CHANNEL_CONFIG.map(({ type, name, description }) => (
                <div
                  key={type}
                  className="flex flex-col rounded-xl border border-border-color bg-card-bg p-4"
                >
                  <h4 className="text-base font-semibold text-text-primary">{name}</h4>
                  <p className="mt-1 flex-1 text-sm text-text-secondary">{description}</p>
                  <div className="mt-3">
                    <MetaConnectButton channel={type} onConnected={refreshChannels} />
                  </div>
                </div>
              ))}
              {!showIndiaMARTForm ? (
                <div className="flex flex-col rounded-xl border border-border-color bg-card-bg p-4">
                  <h4 className="text-base font-semibold text-text-primary">IndiaMART</h4>
                  <p className="mt-1 flex-1 text-sm text-text-secondary">
                    Connect your IndiaMART seller account to receive and respond to leads.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowIndiaMARTForm(true)}
                      className="inline-flex items-center rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                    >
                      Connect IndiaMART
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border-color bg-card-bg p-4 sm:col-span-2 lg:col-span-1">
                  <h4 className="text-base font-semibold text-text-primary">Connect IndiaMART</h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    Enter your IndiaMART Seller ID. Configure the webhook URL in IndiaMART to:{' '}
                    <code className="rounded bg-bg-secondary px-1 py-0.5 text-sm">/api/v1/indiamart/webhook</code>
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Display name</label>
                      <input
                        type="text"
                        value={indiamartName}
                        onChange={(e) => setIndiamartName(e.target.value)}
                        placeholder="IndiaMART"
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Seller ID *</label>
                      <input
                        type="text"
                        value={indiamartSellerId}
                        onChange={(e) => setIndiamartSellerId(e.target.value)}
                        placeholder="Your IndiaMART seller ID"
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                    {indiamartError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{indiamartError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConnectIndiaMART}
                        disabled={indiamartSubmitting}
                        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {indiamartSubmitting ? 'Adding…' : 'Add IndiaMART'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowIndiaMARTForm(false); setIndiamartError(null); }}
                        className="rounded-md border border-border-color px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </ModuleGuard>
  );
}
