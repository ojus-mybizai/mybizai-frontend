'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Send, Repeat, Filter, Coins, Loader2,
  CheckCircle2, Clock, AlertCircle, XCircle, Pause, Archive,
} from 'lucide-react';
import {
  listCampaigns, listSequences, listSegments, getCreditsInfo,
  type Campaign, type Sequence, type Segment, type CreditsInfo,
  type CampaignStatus, type SequenceStatus,
} from '@/services/campaigns';
type Tab = 'campaigns' | 'sequences' | 'segments';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  sending:   { label: 'Sending',   className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  active:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  failed:    { label: 'Failed',    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  archived:  { label: 'Archived',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>;
}

export default function CampaignsHub() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [loading, setLoading] = useState(true);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [campRes, seqRes, segRes, credRes] = await Promise.allSettled([
        listCampaigns({ page_size: 50 }),
        listSequences(),
        listSegments(),
        getCreditsInfo(),
      ]);
      if (campRes.status === 'fulfilled') {
        setCampaigns(campRes.value.items);
        setCampaignTotal(campRes.value.total);
      }
      if (seqRes.status === 'fulfilled') setSequences(seqRes.value);
      if (segRes.status === 'fulfilled') setSegments(segRes.value);
      if (credRes.status === 'fulfilled') setCredits(credRes.value);
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number; icon: typeof Send }[] = [
    { key: 'campaigns', label: 'Campaigns', count: campaignTotal, icon: Send },
    { key: 'sequences', label: 'Sequences', count: sequences.length, icon: Repeat },
    { key: 'segments',  label: 'Segments',  count: segments.length,  icon: Filter },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-text-secondary mt-1">
            Send blasts and multi-step sequences to your contacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {credits && (
            <div className="flex items-center gap-1.5 text-sm text-text-secondary px-3 py-1.5 bg-surface-secondary rounded-lg">
              <Coins className="w-4 h-4" />
              <span className="font-medium">{credits.balance_credits}</span>
              <span>credits</span>
            </div>
          )}
          <button
            onClick={() => router.push('/campaigns/new')}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </button>
        </div>
      </div>

      {/* Tabs — color-coded pills, one identity per content type */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => {
          const colors = {
            campaigns: { active: 'bg-blue-500 text-white shadow-sm shadow-blue-500/30', inactive: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/15' },
            sequences: { active: 'bg-violet-500 text-white shadow-sm shadow-violet-500/30', inactive: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/15' },
            segments:  { active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30', inactive: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' },
          }[t.key];
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all ${
                active ? colors.active : colors.inactive
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : 'bg-white/10'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : (
        <>
          {tab === 'campaigns' && <CampaignsTab campaigns={campaigns} />}
          {tab === 'sequences' && <SequencesTab sequences={sequences} onRefresh={loadAll} />}
          {tab === 'segments' && <SegmentsTab segments={segments} onRefresh={loadAll} />}
        </>
      )}
    </div>
  );
}

/* ─── Campaigns tab ──────────────────────────────────────────────────────── */

function CampaignsTab({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-16">
        <Send className="w-10 h-10 mx-auto text-text-secondary mb-3" />
        <h3 className="text-lg font-medium mb-1">No campaigns yet</h3>
        <p className="text-sm text-text-secondary mb-4">
          Create your first blast campaign to reach your contacts
        </p>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          Create campaign
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-black/15">
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Campaign</th>
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Recipients</th>
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Sent</th>
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Credits</th>
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="hover:bg-white/[0.03] cursor-pointer transition"
              onClick={() => router.push(`/campaigns/${c.id}`)}
            >
              <td className="px-4 py-3">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-text-secondary capitalize">{c.category}</div>
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.total_recipients}</td>
              <td className="px-4 py-3 text-text-secondary">
                {c.sent_count} / {c.total_recipients}
              </td>
              <td className="px-4 py-3 text-text-secondary">{c.sent_count || '—'}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3 text-text-secondary text-xs">
                {c.launched_at
                  ? new Date(c.launched_at).toLocaleDateString()
                  : new Date(c.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Sequences tab ──────────────────────────────────────────────────────── */

function SequencesTab({ sequences, onRefresh }: { sequences: Sequence[]; onRefresh: () => void }) {
  const router = useRouter();

  if (sequences.length === 0) {
    return (
      <div className="text-center py-16">
        <Repeat className="w-10 h-10 mx-auto text-text-secondary mb-3" />
        <h3 className="text-lg font-medium mb-1">No sequences yet</h3>
        <p className="text-sm text-text-secondary mb-4">
          Create a multi-step sequence to nurture contacts over time
        </p>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          Create sequence
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sequences.map((seq) => (
        <div
          key={seq.id}
          onClick={() => router.push(`/campaigns/seq-${seq.id}`)}
          className="bg-surface-secondary rounded-2xl p-4 hover:ring-1 hover:ring-accent/30 cursor-pointer transition"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm truncate">{seq.name}</h3>
            <StatusBadge status={seq.status} />
          </div>
          {seq.description && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-3">{seq.description}</p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface/60 rounded-lg py-2">
              <div className="text-sm font-medium">{seq.steps.length}</div>
              <div className="text-[10px] text-text-secondary">Steps</div>
            </div>
            <div className="bg-surface/60 rounded-lg py-2">
              <div className="text-sm font-medium">{seq.active_enrolled}</div>
              <div className="text-[10px] text-text-secondary">Active</div>
            </div>
            <div className="bg-surface/60 rounded-lg py-2">
              <div className="text-sm font-medium">{seq.reply_rate}%</div>
              <div className="text-[10px] text-text-secondary">Reply rate</div>
            </div>
          </div>
          {/* Step dots */}
          {seq.steps.length > 0 && (
            <div className="flex items-center gap-1 mt-3">
              {seq.steps.slice(0, 6).map((step, i) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-accent/60"
                    title={`Step ${step.step_number}: ${step.delay_days}d ${step.delay_hours}h delay`}
                  />
                  {i < Math.min(seq.steps.length - 1, 5) && (
                    <div className="w-3 h-px bg-white/10" />
                  )}
                </div>
              ))}
              {seq.steps.length > 6 && (
                <span className="text-[10px] text-text-secondary ml-1">+{seq.steps.length - 6} more</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Segments tab ───────────────────────────────────────────────────────── */

function SegmentsTab({ segments, onRefresh }: { segments: Segment[]; onRefresh: () => void }) {
  const router = useRouter();

  if (segments.length === 0) {
    return (
      <div className="text-center py-16">
        <Filter className="w-10 h-10 mx-auto text-text-secondary mb-3" />
        <h3 className="text-lg font-medium mb-1">No saved segments</h3>
        <p className="text-sm text-text-secondary mb-4">
          Save audience filters to reuse across campaigns
        </p>
        <button
          onClick={() => router.push('/outbound/segments')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          New segment
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => router.push('/outbound/segments')}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          New segment
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {segments.map((seg) => (
        <div key={seg.id} className="bg-surface-secondary rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-medium text-sm">{seg.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              {seg.created_by_ai && (
                <span className="bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                  AI
                </span>
              )}
              {seg.cached_count !== null && (
                <span>{seg.cached_count} contacts</span>
              )}
            </div>
          </div>
          {seg.description && (
            <p className="text-xs text-text-secondary mt-1">{seg.description}</p>
          )}
          {/* Filter summary badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {seg.filter_config.group_ids?.length ? (
              <span className="text-[10px] bg-surface/70 text-text-secondary px-1.5 py-0.5 rounded-full">
                {seg.filter_config.group_ids.length} group(s)
              </span>
            ) : null}
            {seg.filter_config.tag_ids?.length ? (
              <span className="text-[10px] bg-surface/70 text-text-secondary px-1.5 py-0.5 rounded-full">
                {seg.filter_config.tag_ids.length} tag(s)
              </span>
            ) : null}
            {seg.filter_config.source_channels?.length ? (
              <span className="text-[10px] bg-surface/70 text-text-secondary px-1.5 py-0.5 rounded-full">
                {seg.filter_config.source_channels.join(', ')}
              </span>
            ) : null}
            {seg.filter_config.priority?.length ? (
              <span className="text-[10px] bg-surface/70 text-text-secondary px-1.5 py-0.5 rounded-full">
                Priority: {seg.filter_config.priority.join(', ')}
              </span>
            ) : null}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
