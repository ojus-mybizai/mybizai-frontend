'use client';

/**
 * Outbound Hub — budget overview + recent campaigns + quick actions.
 *
 * This is the landing page for all outbound messaging (marketing, utility,
 * reminders, follow-ups). Businesses see what they've spent this month by
 * category, can top up their wallet, and launch new campaigns.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import {
  getWalletStats,
  getMetaUsage,
  listCampaigns,
  topupWallet,
  type WalletStats,
  type Campaign,
  type CategorySpend,
  type MetaUsage,
} from '@/services/outbound';

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  marketing: { icon: '📢', label: 'Marketing', color: 'bg-purple-500/10 text-purple-600' },
  utility: { icon: '🧾', label: 'Utility', color: 'bg-blue-500/10 text-blue-600' },
  reminder: { icon: '🔔', label: 'Reminder', color: 'bg-amber-500/10 text-amber-600' },
  followup: { icon: '⏰', label: 'Follow-up', color: 'bg-green-500/10 text-green-600' },
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-yellow-100 text-yellow-700',
  sending: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

function formatMoney(value: string | number, currency = 'INR'): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ──────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────

// ── Meta category display metadata ────────────────────────────────────────
const META_CATEGORY_META: Record<string, { label: string; color: string; desc: string }> = {
  MARKETING:      { label: 'Marketing',      color: 'text-purple-600', desc: 'Promotions, offers, newsletters' },
  UTILITY:        { label: 'Utility',        color: 'text-blue-600',   desc: 'Confirmations, updates, alerts' },
  AUTHENTICATION: { label: 'Authentication', color: 'text-orange-600', desc: 'OTPs and verification codes' },
  SERVICE:        { label: 'Service',        color: 'text-green-600',  desc: 'Customer-initiated conversations' },
};

export default function OutboundHubPage() {
  const router = useRouter();
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [metaUsage, setMetaUsage] = useState<MetaUsage | null>(null);
  const [recent, setRecent] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('500');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [metaTooltipOpen, setMetaTooltipOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, c, m] = await Promise.all([
        getWalletStats(),
        listCampaigns({ page: 1, page_size: 5 }),
        getMetaUsage().catch(() => null),   // non-fatal — show a notice if it fails
      ]);
      setStats(s);
      setRecent(c.items);
      setMetaUsage(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTopup = async () => {
    const n = parseFloat(topupAmount);
    if (!n || n <= 0) return;
    try {
      setTopupSubmitting(true);
      await topupWallet(n, undefined, `Manual top-up ₹${n}`);
      setTopupOpen(false);
      setTopupAmount('500');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setTopupSubmitting(false);
    }
  };

  // Sort categories in the consistent order the mockup used
  const orderedCategories: CategorySpend[] = useMemo(() => {
    if (!stats) return [];
    const order = ['marketing', 'utility', 'reminder', 'followup'];
    return [...stats.by_category].sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
    );
  }, [stats]);

  const budgetPct = useMemo(() => {
    if (!stats?.monthly_budget) return null;
    const budget = parseFloat(stats.monthly_budget);
    const spent = parseFloat(stats.month_total_spent);
    if (!budget) return null;
    return Math.min(100, Math.round((spent / budget) * 100));
  }, [stats]);

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Outbound Hub</h1>
            <p className="text-sm text-gray-500 mt-1">
              Send marketing, utility, reminders, and follow-ups over WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/outbound/segments"
              className="border border-gray-300 dark:border-neutral-700 px-4 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              📑 Segments
            </Link>
            <Link
              href="/outbound/new"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:opacity-90"
            >
              + New Campaign
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : stats ? (
          <>
            {/* ── Budget Overview ─────────────────────────────────── */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Wallet Balance</p>
                  <p className="text-4xl font-bold mt-1">
                    {formatMoney(stats.balance, stats.currency)}
                  </p>
                </div>
                <button
                  onClick={() => setTopupOpen(true)}
                  className="border border-gray-300 dark:border-neutral-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  + Add Funds
                </button>
              </div>

              {/* Monthly budget progress bar */}
              {stats.monthly_budget && budgetPct !== null && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      Spent this month: {formatMoney(stats.month_total_spent)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Budget: {formatMoney(stats.monthly_budget)} ({budgetPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Category breakdown cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {orderedCategories.map((cat) => {
                  const meta = CATEGORY_META[cat.category] ?? {
                    icon: '❓',
                    label: cat.category,
                    color: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <div
                      key={cat.category}
                      className="border border-gray-200 dark:border-neutral-800 rounded-md p-3"
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}
                      >
                        <span>{meta.icon}</span>
                        {meta.label}
                      </div>
                      <p className="text-2xl font-semibold mt-2">
                        {formatMoney(cat.total_spent)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {cat.message_count} message{cat.message_count !== 1 ? 's' : ''}
                        {cat.message_count > 0 && (
                          <> · {formatMoney(cat.avg_cost_per_message)}/msg</>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Meta WhatsApp Usage ─────────────────────────────── */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <h2 className="font-semibold">Meta WhatsApp Conversations</h2>
                  <span className="text-xs text-gray-400">this month</span>
                </div>
                {/* Info tooltip trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMetaTooltipOpen((v) => !v)}
                    className="w-5 h-5 rounded-full border border-gray-300 dark:border-neutral-600 text-xs text-gray-500 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800"
                    aria-label="About Meta conversation pricing"
                  >
                    ?
                  </button>
                  {metaTooltipOpen && (
                    <div className="absolute right-0 top-7 z-20 w-72 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-4 text-xs text-gray-600 dark:text-gray-300 space-y-2">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">How Meta charges for WhatsApp</p>
                      <p>Meta bills per <strong>conversation</strong> (a 24-hour window), not per message.</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>Service</strong> — customer starts the chat. First <strong>1,000/month are free</strong> per WABA.</li>
                        <li><strong>Marketing</strong> — you send a promo/offer template. Always charged.</li>
                        <li><strong>Utility</strong> — you send a confirmation/alert template. Always charged.</li>
                        <li><strong>Authentication</strong> — OTPs. Always charged.</li>
                        <li><strong>Free Entry Point</strong> — started from a Click-to-WhatsApp ad. Free for 72 h.</li>
                      </ul>
                      <p className="text-gray-400">Costs shown are in USD as charged by Meta. Your platform wallet (₹) covers your sending fees separately.</p>
                      <button
                        type="button"
                        onClick={() => setMetaTooltipOpen(false)}
                        className="mt-1 text-primary hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              {!metaUsage ? (
                <p className="text-sm text-gray-400">Loading Meta usage…</p>
              ) : metaUsage.error ? (
                <div className="space-y-3">
                  {/* Main error */}
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-md px-3 py-2">
                    <span className="shrink-0">⚠️</span>
                    <span>{metaUsage.error}</span>
                  </div>

                  {/* Debug info */}
                  {metaUsage.debug && (
                    <details className="text-xs border border-gray-200 dark:border-neutral-700 rounded-md overflow-hidden">
                      <summary className="px-3 py-2 cursor-pointer bg-gray-50 dark:bg-neutral-800 font-medium text-gray-600 dark:text-gray-300 select-none">
                        Debug info (expand to share with support)
                      </summary>
                      <div className="p-3 space-y-2 font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-900">
                        {/* Channel + WABA */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-gray-500">channel_id</span>
                          <span>{metaUsage.debug.channel_id ?? '—'}</span>
                          <span className="text-gray-500">waba_id</span>
                          <span>{metaUsage.debug.waba_id ?? '—'}</span>
                          <span className="text-gray-500">token</span>
                          <span>{metaUsage.debug.token_preview ?? '—'} ({metaUsage.debug.token_length ?? 0} chars)</span>
                          <span className="text-gray-500">granularity</span>
                          <span>{metaUsage.debug.granularity ?? '—'}</span>
                          <span className="text-gray-500">window</span>
                          <span>{metaUsage.debug.start_epoch} → {metaUsage.debug.end_epoch}</span>
                        </div>

                        {metaUsage.debug.note && (
                          <div className="text-amber-600 dark:text-amber-400">note: {metaUsage.debug.note}</div>
                        )}

                        {/* Per-call log */}
                        {metaUsage.debug.calls?.map((call, i) => (
                          <div key={i} className="border-t border-gray-100 dark:border-neutral-800 pt-2 space-y-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-200">
                              Call {i + 1}
                              {call.params?.dimensions ? ` — dim=${String(call.params.dimensions)}` : ' — (no dimensions)'}
                              {' '}
                              <span className={call.status === 200 ? 'text-green-600' : 'text-red-500'}>
                                HTTP {call.status ?? 'ERR'}
                              </span>
                            </div>
                            <div className="text-gray-500 break-all">{call.exact_url}</div>
                            {!!call.meta_error && (
                              <pre className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded p-2 whitespace-pre-wrap break-all">
                                {typeof call.meta_error === 'string'
                                  ? call.meta_error
                                  : JSON.stringify(call.meta_error, null, 2)}
                              </pre>
                            )}
                            {call.response_body && (
                              <pre className="bg-gray-50 dark:bg-neutral-800 rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                                {call.response_body}
                              </pre>
                            )}
                          </div>
                        ))}

                        {/* Channel candidates (pre-call error) */}
                        {metaUsage.debug.channel_candidates && (
                          <div className="border-t border-gray-100 dark:border-neutral-800 pt-2">
                            <div className="font-semibold mb-1">WhatsApp channels found:</div>
                            {metaUsage.debug.channel_candidates.map((c) => (
                              <div key={c.id}>id={c.id} name=&quot;{c.name}&quot; connected={String(c.is_connected)}</div>
                            ))}
                          </div>
                        )}

                        {metaUsage.debug.config_keys && (
                          <div className="border-t border-gray-100 dark:border-neutral-800 pt-2">
                            config keys present: [{metaUsage.debug.config_keys.join(', ')}]
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Free-tier service conversations */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Free Service Conversations
                      </span>
                      <span className={`font-semibold ${metaUsage.free_tier_used >= metaUsage.free_tier_limit ? 'text-red-600' : metaUsage.free_tier_used >= metaUsage.free_tier_limit * 0.8 ? 'text-amber-600' : 'text-green-600'}`}>
                        {metaUsage.free_tier_used.toLocaleString()} / {metaUsage.free_tier_limit.toLocaleString()} used
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          metaUsage.free_tier_used >= metaUsage.free_tier_limit
                            ? 'bg-red-500'
                            : metaUsage.free_tier_used >= metaUsage.free_tier_limit * 0.8
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((metaUsage.free_tier_used / metaUsage.free_tier_limit) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {metaUsage.free_tier_used >= metaUsage.free_tier_limit
                        ? 'Free quota exhausted — all service conversations are now charged.'
                        : `${(metaUsage.free_tier_limit - metaUsage.free_tier_used).toLocaleString()} free conversations remaining this month.`}
                    </p>
                  </div>

                  {/* Category breakdown */}
                  {Object.keys(metaUsage.by_category).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(metaUsage.by_category).map(([cat, usage]) => {
                        const m = META_CATEGORY_META[cat] ?? { label: cat, color: 'text-gray-600', desc: '' };
                        return (
                          <div
                            key={cat}
                            className="border border-gray-200 dark:border-neutral-800 rounded-md p-3 space-y-1"
                          >
                            <p className={`text-xs font-semibold uppercase tracking-wide ${m.color}`}>
                              {m.label}
                            </p>
                            <p className="text-2xl font-bold">{usage.count.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">{m.desc}</p>
                            {usage.cost_usd > 0 && (
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-neutral-800">
                                ${usage.cost_usd.toFixed(4)} USD
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No conversations sent yet this month.</p>
                  )}

                  {/* Type breakdown (free tier / regular / free entry) */}
                  {Object.keys(metaUsage.by_type).length > 0 && (
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-neutral-800">
                      {Object.entries(metaUsage.by_type).map(([type, bucket]) => {
                        const labels: Record<string, string> = {
                          REGULAR: 'Paid conversations',
                          FREE_TIER: 'Free tier (service)',
                          FREE_ENTRY_POINT: 'Free entry (Click-to-WA)',
                        };
                        return (
                          <span key={type}>
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {bucket.count.toLocaleString()}
                            </span>{' '}
                            {labels[type] ?? type.toLowerCase().replace(/_/g, ' ')}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Total Meta charges */}
                  {metaUsage.total_cost_usd > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500">Total Meta charges this month</span>
                      <span className="font-semibold">${metaUsage.total_cost_usd.toFixed(4)} USD</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Meta Billing Info ───────────────────────────────── */}
            <div className="border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <div>
                    <h2 className="font-semibold text-gray-800 dark:text-gray-100">Meta WhatsApp Billing</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Meta charges your business directly — separate from your platform wallet.
                    </p>
                  </div>
                </div>
                {/* Quick links */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <a
                    href="https://business.facebook.com/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-center whitespace-nowrap"
                  >
                    Manage Payment →
                  </a>
                  <a
                    href="https://business.facebook.com/wa/manage/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-center whitespace-nowrap"
                  >
                    WhatsApp Manager →
                  </a>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* How billing works */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">How it works</p>
                  <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                      Meta bills <strong>per conversation</strong> (24-hour window), not per message. All messages within that window are free after the first.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                      Charges go directly to the <strong>payment method on your Meta Business Manager</strong> — no manual top-up needed.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                      Meta charges when you hit your billing threshold (usually $25, $50, or $100 depending on account age).
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                      You can set an <strong>Account Spending Limit</strong> in Meta Business Manager to cap monthly spend.
                    </li>
                  </ul>
                </div>

                {/* Pricing table */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Approx. rates (India, USD)</p>
                  <div className="rounded-md overflow-hidden border border-blue-100 dark:border-blue-900 text-xs">
                    <div className="grid grid-cols-3 bg-blue-100/60 dark:bg-blue-900/30 px-3 py-1.5 font-semibold text-gray-600 dark:text-gray-300">
                      <span>Type</span>
                      <span>Who opens</span>
                      <span>Cost</span>
                    </div>
                    {[
                      { type: 'Service',        who: 'Customer',   cost: '~$0.004', free: '1,000 free/mo', color: 'text-green-600' },
                      { type: 'Utility',        who: 'You',        cost: '~$0.004', free: null,            color: 'text-blue-600' },
                      { type: 'Marketing',      who: 'You',        cost: '~$0.011', free: null,            color: 'text-purple-600' },
                      { type: 'Authentication', who: 'You',        cost: '~$0.003', free: null,            color: 'text-orange-600' },
                    ].map((row) => (
                      <div key={row.type} className="grid grid-cols-3 px-3 py-1.5 border-t border-blue-100 dark:border-blue-900 bg-white dark:bg-neutral-900">
                        <span className={`font-medium ${row.color}`}>{row.type}</span>
                        <span className="text-gray-500">{row.who}</span>
                        <span>
                          {row.cost}
                          {row.free && (
                            <span className="ml-1 text-green-600 font-medium">({row.free})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Rates vary by recipient country. Check exact rates in WhatsApp Manager.</p>
                </div>
              </div>

              {/* Required checklist */}
              <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Required for messages to send
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  {[
                    'Valid credit/debit card added in Meta Business Manager',
                    'WhatsApp Business terms accepted in WhatsApp Manager',
                    'WABA status is "Connected" in WhatsApp Manager → Overview',
                    'Template approved by Meta before sending marketing/utility messages',
                    'Account Spending Limit not reached (check Meta Billing)',
                    'Phone number not banned or restricted by Meta',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-blue-400 shrink-0">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common issues */}
              <details className="mt-3">
                <summary className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline select-none">
                  Common reasons messages stop sending ▾
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  {[
                    ['Card declined / expired', 'Update payment method at business.facebook.com/billing'],
                    ['Spending limit reached', 'Raise or remove the limit in Meta Business Manager → Billing'],
                    ['Template rejected', 'Edit and resubmit the template in WhatsApp Manager → Message Templates'],
                    ['Quality rating dropped', 'Reduce opt-out rate; avoid sending to uninterested users'],
                    ['Messaging limit reduced', 'Tier upgrades automatically as you send more messages with high quality'],
                    ['WABA under review', 'Check WhatsApp Manager → Account Health for any pending actions'],
                  ].map(([issue, fix]) => (
                    <div key={issue} className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-red-400 shrink-0">!</span>
                      <span><strong>{issue}</strong> — {fix}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* ── Quick Actions ───────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link
                href="/outbound/new?category=marketing"
                className="border border-gray-200 dark:border-neutral-800 rounded-md p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
              >
                <div className="text-2xl">📢</div>
                <div className="mt-2 font-medium">Marketing Blast</div>
                <div className="text-xs text-gray-500 mt-0.5">Promos, offers</div>
              </Link>
              <Link
                href="/outbound/new?category=utility"
                className="border border-gray-200 dark:border-neutral-800 rounded-md p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
              >
                <div className="text-2xl">🧾</div>
                <div className="mt-2 font-medium">Utility Message</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Confirmations, receipts
                </div>
              </Link>
              <Link
                href="/outbound/new?category=reminder"
                className="border border-gray-200 dark:border-neutral-800 rounded-md p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
              >
                <div className="text-2xl">🔔</div>
                <div className="mt-2 font-medium">Reminder</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Appointments, deadlines
                </div>
              </Link>
              <Link
                href="/outbound/new?category=followup"
                className="border border-gray-200 dark:border-neutral-800 rounded-md p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 text-left"
              >
                <div className="text-2xl">⏰</div>
                <div className="mt-2 font-medium">Follow-up</div>
                <div className="text-xs text-gray-500 mt-0.5">Lead nurture</div>
              </Link>
            </div>

            {/* ── Recent Campaigns ────────────────────────────────── */}
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800">
                <h2 className="font-semibold">Recent Campaigns</h2>
                <Link href="/outbound/campaigns" className="text-sm text-primary hover:underline">
                  View all →
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No campaigns yet.</p>
                  <Link
                    href="/outbound/new"
                    className="inline-block mt-3 text-primary hover:underline"
                  >
                    Create your first campaign →
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {recent.map((c) => {
                    const meta = CATEGORY_META[c.category] ?? { icon: '', label: c.category, color: '' };
                    const pill = STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-700';
                    return (
                      <li key={c.id} className="flex items-center hover:bg-gray-50 dark:hover:bg-neutral-800 group">
                        <Link
                          href={`/outbound/${c.id}`}
                          className="flex flex-1 items-center gap-3 p-4 min-w-0"
                        >
                          <span className="text-xl shrink-0">{meta.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {c.total_recipients} recipients
                              {c.status !== 'draft' && (
                                <>
                                  {' · '}
                                  {c.sent_count}/{c.total_recipients} sent
                                </>
                              )}
                              {' · '}
                              {formatMoney(c.actual_cost || c.estimated_cost)}
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${pill}`}>
                            {c.status}
                          </span>
                        </Link>
                        {/* Repeat campaign button */}
                        <button
                          type="button"
                          title="Repeat this campaign"
                          onClick={() => router.push(`/outbound/new?repeat=${c.id}`)}
                          className="mr-3 px-2.5 py-1 text-xs font-medium border border-gray-300 dark:border-neutral-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                          🔁 Repeat
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}

        {/* ── Top-up Modal ──────────────────────────────────────── */}
        {topupOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Add Funds to Wallet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Add balance to send marketing, utility, reminder, and follow-up
                messages.
              </p>

              <label className="block text-sm font-medium mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
              />

              <div className="flex gap-2 mt-3">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(String(amt))}
                    className="text-xs px-3 py-1 border border-gray-300 dark:border-neutral-700 rounded-full hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setTopupOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopup}
                  disabled={topupSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  {topupSubmitting ? 'Adding…' : 'Add Funds'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
