'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { FacebookSDKLoader } from '@/components/integrations/FacebookSDKLoader';
import { MetaConnectButton } from '@/components/integrations/MetaConnectButton';
import { createChannel, deleteChannel, listChannels, type Channel, type MetaChannelType } from '@/services/channels';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'channels' | 'meta-ads';

interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  verifyToken: string;
  pageId: string;
  enabled: boolean;
}

interface MetaAdLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  adName: string;
  adSet: string;
  campaign: string;
  formName: string;
  submittedAt: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted';
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_META_LEADS: MetaAdLead[] = [
  {
    id: '1',
    name: 'Priya Sharma',
    email: 'priya.sharma@gmail.com',
    phone: '+91 98765 43210',
    adName: 'Summer Sale — 3BHK',
    adSet: 'Mumbai - 25-45 - Homebuyers',
    campaign: 'Q1 2026 — New Launches',
    formName: 'Project Inquiry Form',
    submittedAt: '2026-03-18T09:14:00Z',
    status: 'new',
  },
  {
    id: '2',
    name: 'Rohan Mehta',
    email: 'rohan.m@outlook.com',
    phone: '+91 91234 56789',
    adName: 'Commercial Office — Andheri',
    adSet: 'Mumbai - Business Owners',
    campaign: 'Commercial Q1 2026',
    formName: 'Commercial Inquiry',
    submittedAt: '2026-03-18T08:02:00Z',
    status: 'contacted',
  },
  {
    id: '3',
    name: 'Sunita Patel',
    email: 'sunita.patel@yahoo.com',
    phone: '+91 87654 32109',
    adName: 'Luxury 2BHK — Powai',
    adSet: 'Thane - HNI Segment',
    campaign: 'Q1 2026 — Luxury',
    formName: 'Site Visit Request',
    submittedAt: '2026-03-17T17:45:00Z',
    status: 'qualified',
  },
  {
    id: '4',
    name: 'Amit Kulkarni',
    email: 'amit.k@gmail.com',
    phone: '+91 70000 11223',
    adName: 'Plot Launch — Pune',
    adSet: 'Pune - Investors',
    campaign: 'Pune Expansion 2026',
    formName: 'Project Inquiry Form',
    submittedAt: '2026-03-17T14:30:00Z',
    status: 'converted',
  },
  {
    id: '5',
    name: 'Neha Joshi',
    email: 'neha.joshi@gmail.com',
    phone: '+91 99887 76655',
    adName: 'Summer Sale — 3BHK',
    adSet: 'Mumbai - 25-45 - Homebuyers',
    campaign: 'Q1 2026 — New Launches',
    formName: 'Project Inquiry Form',
    submittedAt: '2026-03-17T11:15:00Z',
    status: 'new',
  },
];

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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<MetaAdLead['status'], string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  contacted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

function StatusBadge({ status }: { status: MetaAdLead['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Meta Ads Tab ─────────────────────────────────────────────────────────────

function MetaAdsTab() {
  const WEBHOOK_URL = `${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/v1/meta-ads/webhook`;
  const VERIFY_TOKEN_PLACEHOLDER = 'mybizai_meta_verify_2026';

  const [config, setConfig] = useState<MetaAdsConfig>({
    appId: '',
    appSecret: '',
    verifyToken: VERIFY_TOKEN_PLACEHOLDER,
    pageId: '',
    enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<MetaAdLead['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setConfig((prev) => ({ ...prev, enabled: true }));
      setTimeout(() => setSaved(false), 3000);
    }, 1200);
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800);
  };

  const filteredLeads = MOCK_META_LEADS.filter((lead) => {
    const matchFilter = filter === 'all' || lead.status === filter;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.phone.includes(q) ||
      lead.campaign.toLowerCase().includes(q) ||
      lead.adName.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const stats = {
    total: MOCK_META_LEADS.length,
    new: MOCK_META_LEADS.filter((l) => l.status === 'new').length,
    converted: MOCK_META_LEADS.filter((l) => l.status === 'converted').length,
  };

  return (
    <div className="space-y-6">

      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        config.enabled
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
      }`}>
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${config.enabled ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
            {config.enabled ? 'Meta Ads webhook is active — leads are being captured automatically' : 'Meta Ads not connected — set up the webhook below to start capturing leads'}
          </p>
        </div>
        {config.enabled && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Active
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-text-primary' },
          { label: 'New Today', value: stats.new, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Converted', value: stats.converted, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border-color bg-card-bg px-4 py-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="mt-0.5 text-sm text-text-secondary">{label}</div>
          </div>
        ))}
      </div>

      {/* Webhook Setup Card */}
      <div className="rounded-xl border border-border-color bg-card-bg p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Webhook Configuration</h3>
            <p className="mt-0.5 text-sm text-text-secondary">
              Paste these values into your Meta for Developers app under{' '}
              <span className="font-medium text-text-primary">Products → Facebook Lead Ads → Webhooks</span>
            </p>
          </div>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary"
          >
            Open Meta Developer →
          </a>
        </div>

        {/* Step 1 — Webhook URL */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">1</span>
            Callback URL (paste in Meta webhook setup)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary">
              {WEBHOOK_URL}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(WEBHOOK_URL, 'url')}
              className="flex-shrink-0 rounded-md border border-border-color px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
            >
              {copied === 'url' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Step 2 — Verify Token */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">2</span>
            Verify Token (paste in Meta webhook setup)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={config.verifyToken}
              onChange={(e) => setConfig((p) => ({ ...p, verifyToken: e.target.value }))}
              className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary"
              placeholder="Your custom verify token"
            />
            <button
              type="button"
              onClick={() => handleCopy(config.verifyToken, 'token')}
              className="flex-shrink-0 rounded-md border border-border-color px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
            >
              {copied === 'token' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-text-secondary">Use the same string in Meta and here. This verifies that requests come from Meta.</p>
        </div>

        {/* Step 3 — App credentials */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">3</span>
            Meta App credentials (from Meta App Dashboard → Settings → Basic)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">App ID</label>
              <input
                type="text"
                value={config.appId}
                onChange={(e) => setConfig((p) => ({ ...p, appId: e.target.value }))}
                placeholder="e.g. 1234567890123456"
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">App Secret</label>
              <input
                type="password"
                value={config.appSecret}
                onChange={(e) => setConfig((p) => ({ ...p, appSecret: e.target.value }))}
                placeholder="Hidden — stored securely"
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Facebook Page ID <span className="text-text-secondary font-normal">(optional)</span></label>
              <input
                type="text"
                value={config.pageId}
                onChange={(e) => setConfig((p) => ({ ...p, pageId: e.target.value }))}
                placeholder="Your FB Page ID"
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border-color pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved & Active' : 'Save & Activate Webhook'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Webhook is now listening for leads from Meta Ads!
            </span>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-border-color bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Quick setup guide — Meta Lead Ads</h3>
        <ol className="space-y-2.5 text-sm text-text-secondary list-none">
          {[
            'Go to Meta for Developers → Your App → Products → Add Product → Facebook Lead Ads.',
            'Under Webhooks, click Subscribe to a field → select leadgen.',
            'Paste the Callback URL and Verify Token above → click Verify and Save.',
            'Subscribe your Facebook Page to the leadgen webhook event.',
            'Enter your App ID and App Secret in the form above, then click Save & Activate.',
            'Run a test lead via Meta\'s Lead Ads Testing Tool — it should appear in the table below within seconds.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-bg-secondary border border-border-color text-xs flex items-center justify-center text-text-secondary font-medium">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Captured Leads Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text-primary">
            Captured Leads
            <span className="ml-2 rounded-full bg-bg-secondary border border-border-color px-2 py-0.5 text-xs font-normal text-text-secondary">
              {MOCK_META_LEADS.length} total (mock)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="rounded-md border border-border-color px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '↻ Sync Now'}
            </button>
            <Link
              href="/customers?source=meta_ads"
              className="rounded-md border border-border-color px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
            >
              View All in CRM →
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, campaign…"
            className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary w-64"
          />
          <div className="flex rounded-md border border-border-color overflow-hidden">
            {(['all', 'new', 'contacted', 'qualified', 'converted'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === s
                    ? 'bg-accent text-white'
                    : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary/50">
                  <th className="px-4 py-3 font-semibold text-text-primary">Lead</th>
                  <th className="px-4 py-3 font-semibold text-text-primary">Contact</th>
                  <th className="px-4 py-3 font-semibold text-text-primary">Ad / Campaign</th>
                  <th className="px-4 py-3 font-semibold text-text-primary">Form</th>
                  <th className="px-4 py-3 font-semibold text-text-primary">Received</th>
                  <th className="px-4 py-3 font-semibold text-text-primary">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-primary text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                      No leads match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border-color last:border-b-0 hover:bg-bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{lead.name}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{lead.email}</div>
                        <div className="text-xs">{lead.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary text-xs">{lead.adName}</div>
                        <div className="text-xs text-text-secondary">{lead.campaign}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{lead.formName}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{timeAgo(lead.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/customers?search=${encodeURIComponent(lead.email)}`}
                          className="rounded border border-border-color px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary"
                        >
                          Open in CRM
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Channels Tab ─────────────────────────────────────────────────────────────

function ChannelsTab() {
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
      setChannelsError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  const handleRemoveChannel = async (channelId: string) => {
    if (!confirm('Remove this channel from your business?')) return;
    setRemovingId(channelId);
    try {
      await deleteChannel(channelId);
      await loadChannels();
    } catch (err) {
      setChannelsError(err instanceof Error ? err.message : 'Failed to remove channel');
    } finally {
      setRemovingId(null);
    }
  };

  const handleConnectIndiaMART = async () => {
    const name = indiamartName.trim() || 'IndiaMART';
    const sellerId = indiamartSellerId.trim();
    if (!sellerId) { setIndiamartError('Seller ID is required'); return; }
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

  const typeCount: Record<string, number> = {};
  channels.forEach((ch) => { typeCount[ch.type] = (typeCount[ch.type] ?? 0) + 1; });

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
      <div className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
        <div className="font-semibold text-text-primary mb-1 text-base">Messaging channel management</div>
        <div>
          Connect WhatsApp, Instagram, and Messenger to capture leads. Messages on connected channels create leads automatically.
          If Business Agents is enabled, you can deploy agents from{' '}
          <Link href="/agents" className="text-accent hover:underline">Business Agents</Link>.
        </div>
      </div>

      <FacebookSDKLoader />

      {channelsError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {channelsError}
        </div>
      )}

      {/* Connected channels */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-text-primary">Your channels</h3>
          <button
            type="button"
            onClick={loadChannels}
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
                  {channels.map((ch, i) => {
                    const displayName = getDisplayName(ch, i);
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
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${
                            ch.isConnected
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${ch.isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
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

      {/* Connect new channel */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Connect new channel</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNEL_CONFIG.map(({ type, name, description }) => (
            <div key={type} className="flex flex-col rounded-xl border border-border-color bg-card-bg p-4">
              <h4 className="text-base font-semibold text-text-primary">{name}</h4>
              <p className="mt-1 flex-1 text-sm text-text-secondary">{description}</p>
              <div className="mt-3">
                <MetaConnectButton channel={type} onConnected={loadChannels} />
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
                Webhook URL:{' '}
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
                {indiamartError && <p className="text-sm text-red-600 dark:text-red-400">{indiamartError}</p>}
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: 'channels', label: 'Messaging Channels' },
  { id: 'meta-ads', label: 'Meta Ads', badge: 'Lead Forms' },
];

export default function LeadSourcesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('channels');

  return (
    <PermissionGuard permission="manage_channels" module="lms">
      <div className="w-full max-w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Lead Sources</h2>
            <p className="mt-0.5 text-base text-text-secondary">
              Manage all the channels and integrations that bring leads into MyBizAI — messaging channels, Meta Ads lead forms, and more.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border-color bg-bg-secondary p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-card-bg text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'channels' ? <ChannelsTab /> : <MetaAdsTab />}
      </div>
    </PermissionGuard>
  );
}
