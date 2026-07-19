'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { FacebookSDKLoader } from '@/components/integrations/FacebookSDKLoader';
import { MetaConnectButton } from '@/components/integrations/MetaConnectButton';
import { WhatsAppManualConnectModal } from '@/components/integrations/WhatsAppManualConnectModal';
import {
  connectIndiaMART,
  deleteChannel,
  getIndiaMARTStatus,
  listChannels,
  setChannelAgent,
  syncIndiaMARTNow,
  type Channel,
  type IndiaMARTStatus,
  type MetaChannelType,
} from '@/services/channels';
import { listAgents, type Agent } from '@/services/agents';

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingAgentFor, setSavingAgentFor] = useState<string | null>(null);
  const [showWhatsAppManual, setShowWhatsAppManual] = useState(false);
  const [showIndiaMARTForm, setShowIndiaMARTForm] = useState(false);
  const [showIndiaMARTHelp, setShowIndiaMARTHelp] = useState(false);
  const [indiamartName, setIndiamartName] = useState('');
  const [indiamartCrmKey, setIndiamartCrmKey] = useState('');
  const [indiamartSubmitting, setIndiamartSubmitting] = useState(false);
  const [indiamartError, setIndiamartError] = useState<string | null>(null);
  const [indiamartSuccess, setIndiamartSuccess] = useState<string | null>(null);
  const [imStatuses, setImStatuses] = useState<Record<string, IndiaMARTStatus>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadIndiaMARTStatuses = useCallback(async (chs: Channel[]) => {
    const imChannels = chs.filter((c) => c.type === 'indiamart' || c.type === 'india_mart');
    if (imChannels.length === 0) return;
    const entries = await Promise.all(
      imChannels.map(async (c) => {
        try {
          return [c.id, await getIndiaMARTStatus(c.id)] as const;
        } catch {
          return null;
        }
      })
    );
    setImStatuses((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      return next;
    });
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      setChannelsError(null);
      const data = await listChannels();
      setChannels(data);
      void loadIndiaMARTStatuses(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load channels';
      setChannelsError(msg);
    } finally {
      setChannelsLoading(false);
    }
  }, [loadIndiaMARTStatuses]);

  useEffect(() => {
    void loadChannels();
    listAgents().then(setAgents).catch(() => {});
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
    const name = indiamartName.trim();
    const crmKey = indiamartCrmKey.trim();
    if (!crmKey) {
      setIndiamartError('CRM key is required');
      return;
    }
    setIndiamartSubmitting(true);
    setIndiamartError(null);
    setIndiamartSuccess(null);
    try {
      const result = await connectIndiaMART(crmKey, name || undefined);
      setShowIndiaMARTForm(false);
      setIndiamartName('');
      setIndiamartCrmKey('');
      setIndiamartSuccess(result.message);
      await loadChannels();
    } catch (err) {
      setIndiamartError(err instanceof Error ? err.message : 'Failed to connect IndiaMART');
    } finally {
      setIndiamartSubmitting(false);
    }
  };

  const handleSyncIndiaMART = async (channelId: string) => {
    setSyncingId(channelId);
    setChannelsError(null);
    try {
      const result = await syncIndiaMARTNow(channelId);
      setIndiamartSuccess(
        result.leads_imported > 0
          ? `Sync complete — ${result.leads_imported} new lead(s) imported.`
          : result.message
      );
      await loadChannels();
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const refreshChannels = useCallback(async () => {
    try {
      setChannelsLoading(true);
      setChannelsError(null);
      const data = await listChannels();
      setChannels(data);
      void loadIndiaMARTStatuses(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh channels';
      setChannelsError(msg);
    } finally {
      setChannelsLoading(false);
    }
  }, [loadIndiaMARTStatuses]);

  const handleSetAgent = async (channelId: string, agentId: number | null) => {
    setSavingAgentFor(channelId);
    try {
      await setChannelAgent(channelId, agentId);
      // Note: don't touch isConnected here. Agent assignment is independent
      // of platform-level connectivity. Only the derived agentAssigned flag
      // tracks "AI will auto-reply".
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, agentId: agentId, agentAssigned: agentId !== null }
            : ch
        )
      );
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Failed to set default agent');
    } finally {
      setSavingAgentFor(null);
    }
  };

  const CHAT_TYPES = new Set<string>(['whatsapp', 'instagram', 'messenger']);

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
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {channelsError}
            </div>
          )}

          {indiamartSuccess && (
            <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span>{indiamartSuccess}</span>
              <button
                type="button"
                onClick={() => setIndiamartSuccess(null)}
                className="ml-3 font-medium hover:underline"
              >
                Dismiss
              </button>
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
                        <th className="px-4 py-3 font-semibold text-text-primary">Default AI Agent</th>
                        <th className="px-4 py-3 font-semibold text-text-primary">Leads</th>
                        <th className="px-4 py-3 font-semibold text-text-primary text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch, indexInList) => {
                        const displayName = getDisplayName(ch, indexInList);
                        const typeLabel = CHANNEL_TYPE_LABELS[ch.type] || ch.type;
                        const leadCount = ch.leadCount ?? 0;
                        const isIndiaMART = ch.type === 'indiamart' || ch.type === 'india_mart';
                        const imStatus = isIndiaMART ? imStatuses[ch.id] : undefined;
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
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
                                }`}
                                title={ch.isConnected
                                  ? 'Platform credentials valid — channel can send and receive.'
                                  : 'Platform credentials missing or invalid.'}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    ch.isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                {ch.isConnected ? 'Connected' : 'Not connected'}
                              </span>
                              {/* AI auto-reply indicator — only for chat channels where the
                                  concept is meaningful (IndiaMART/Amazon don't auto-reply). */}
                              {CHAT_TYPES.has(ch.type) && ch.isConnected && (
                                ch.agentAssigned ? (
                                  <div
                                    className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                                    title="An AI agent is bound to this channel and will auto-reply on inbound messages."
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    AI auto-reply on
                                  </div>
                                ) : (
                                  <div
                                    className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                                    title="No AI agent assigned. Inbound messages will not get an automated reply — pick an agent in the next column."
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Manual replies only
                                  </div>
                                )
                              )}
                              {imStatus && (
                                <div className="mt-1 text-xs text-text-secondary">
                                  {imStatus.sync_error ? (
                                    <span className="text-red-600 dark:text-red-400">{imStatus.sync_error}</span>
                                  ) : imStatus.last_synced_at ? (
                                    <>Last synced {new Date(imStatus.last_synced_at).toLocaleString()} · {imStatus.leads_24h} lead(s) in 24h</>
                                  ) : (
                                    <>First sync within 5 minutes</>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={ch.agentId ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleSetAgent(ch.id, val ? Number(val) : null);
                                }}
                                disabled={savingAgentFor === ch.id}
                                className="w-full max-w-[180px] rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
                              >
                                <option value="">No agent</option>
                                {agents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {isIndiaMART && imStatus?.connected_via === 'pull_api' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncIndiaMART(ch.id)}
                                    disabled={syncingId === ch.id}
                                    className="rounded border border-border-color px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                                  >
                                    {syncingId === ch.id ? 'Syncing…' : 'Sync now'}
                                  </button>
                                )}
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <MetaConnectButton channel={type} onConnected={refreshChannels} />
                    {type === 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => setShowWhatsAppManual(true)}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Add manually (advanced)
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!showIndiaMARTForm ? (
                <div className="flex flex-col rounded-xl border border-border-color bg-card-bg p-4">
                  <h4 className="text-base font-semibold text-text-primary">IndiaMART</h4>
                  <p className="mt-1 flex-1 text-sm text-text-secondary">
                    Paste your IndiaMART CRM key once — leads sync automatically every 5 minutes. No webhook setup needed.
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
                    Paste your IndiaMART CRM key. We verify it instantly and import your last 7 days of inquiries.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowIndiaMARTHelp((v) => !v)}
                    className="mt-1 text-sm font-medium text-accent hover:underline"
                  >
                    {showIndiaMARTHelp ? 'Hide help' : 'Where do I find my CRM key?'}
                  </button>
                  {showIndiaMARTHelp && (
                    <ol className="mt-2 list-decimal space-y-1 rounded-md bg-bg-secondary p-3 pl-7 text-sm text-text-secondary">
                      <li>Log in to your IndiaMART Seller Panel (seller.indiamart.com)</li>
                      <li>Go to Settings → Account Settings</li>
                      <li>Find &ldquo;Lead Manager CRM Integration&rdquo; and click <strong>Generate Key</strong></li>
                      <li>Copy the key and paste it below</li>
                    </ol>
                  )}
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">CRM key *</label>
                      <input
                        type="text"
                        value={indiamartCrmKey}
                        onChange={(e) => setIndiamartCrmKey(e.target.value)}
                        placeholder="Paste your IndiaMART CRM key"
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Display name (optional)</label>
                      <input
                        type="text"
                        value={indiamartName}
                        onChange={(e) => setIndiamartName(e.target.value)}
                        placeholder="IndiaMART"
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
                        {indiamartSubmitting ? 'Verifying & importing…' : 'Connect'}
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

          <WhatsAppManualConnectModal
            open={showWhatsAppManual}
            onClose={() => setShowWhatsAppManual(false)}
            onConnected={refreshChannels}
          />
        </div>
  );
}
