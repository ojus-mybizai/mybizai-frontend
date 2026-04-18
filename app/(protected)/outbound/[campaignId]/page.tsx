'use client';

/**
 * Campaign Detail — live stats + recipient table.
 *
 * Refreshes every 5s while the campaign is 'sending' so the counters move in
 * near-real-time. Gives the business a chance to cancel a mid-flight campaign.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import {
  cancelCampaign,
  getCampaign,
  listCampaignRecipients,
  type Campaign,
  type CampaignRecipient,
} from '@/services/outbound';

function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Meta error codes that indicate a billing/account block
const BILLING_ERROR_CODES = new Set(['131042', '131043', '131031']);

const BILLING_ERROR_HELP: Record<string, { title: string; body: string }> = {
  '131042': {
    title: 'Business Eligibility — Payment Issue',
    body: 'Your Meta Business Account has no valid payment method, or your last payment failed. Add or update your card at Meta Business Manager → Billing & Payments. Once fixed, create a new campaign to retry.',
  },
  '131043': {
    title: 'Payment Account Not Found',
    body: 'Your WhatsApp Business Account (WABA) is not linked to a Meta Business Manager with a payment method. Go to business.facebook.com → Settings → WhatsApp Accounts and ensure your WABA is there, then add a payment method under Billing.',
  },
  '131031': {
    title: 'Account Locked',
    body: 'Your Meta account has been locked. Go to WhatsApp Manager → Account Health to see required actions.',
  },
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-gray-500',
  scheduled: 'text-yellow-600',
  sending: 'text-blue-600',
  sent: 'text-blue-600',
  delivered: 'text-green-600',
  read: 'text-green-700 font-medium',
  replied: 'text-emerald-700 font-semibold',
  failed: 'text-red-600',
  skipped: 'text-gray-400',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Number(params?.campaignId);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        getCampaign(campaignId),
        listCampaignRecipients(campaignId, { limit: 200 }),
      ]);
      setCampaign(c);
      setRecipients(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    void load();
  }, [campaignId, load]);

  // Auto-refresh while campaign is live
  useEffect(() => {
    if (!campaign) return;
    if (campaign.status !== 'sending' && campaign.status !== 'scheduled') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [campaign, load]);

  const handleCancel = async () => {
    if (!confirm('Cancel this campaign? Already-sent messages cannot be recalled.')) return;
    setCancelling(true);
    try {
      await cancelCampaign(campaignId);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (!campaign) {
    return (
      <div className="p-6">
        {error ? <p className="text-red-600">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  const total = campaign.total_recipients || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Link href="/outbound" className="text-sm text-gray-500 hover:text-primary">
            ← Back to Outbound Hub
          </Link>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-2xl font-semibold">{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded-full capitalize">
                  {campaign.category}
                </span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full capitalize">
                  {campaign.status}
                </span>
              </div>
            </div>
            {(campaign.status === 'sending' || campaign.status === 'scheduled') && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel Campaign'}
              </button>
            )}
          </div>
        </div>

        {/* ── Billing error banner ──────────────────────────────── */}
        {(() => {
          // Find the first recipient that has a billing-related error code
          const billingRecipient = recipients.find(
            (r) => r.error_code && BILLING_ERROR_CODES.has(r.error_code),
          );
          if (!billingRecipient || !billingRecipient.error_code) return null;
          const help = BILLING_ERROR_HELP[billingRecipient.error_code];
          return (
            <div className="border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-lg shrink-0">🚫</span>
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    Campaign halted — {help?.title ?? `Meta error ${billingRecipient.error_code}`}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                    {help?.body ?? billingRecipient.error_message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://business.facebook.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Open Meta Billing →
                </a>
                <a
                  href="https://business.facebook.com/wa/manage/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-3 py-1.5 border border-red-300 text-red-700 dark:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20"
                >
                  WhatsApp Manager →
                </a>
                <span className="text-xs text-red-500 dark:text-red-400">
                  Error code: {billingRecipient.error_code}
                  {billingRecipient.error_code && ` · ${recipients.filter((r) => r.error_code === billingRecipient.error_code).length} recipient(s) affected`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Recipients" value={campaign.total_recipients} />
          <StatCard label="Sent" value={campaign.sent_count} pct={pct(campaign.sent_count)} />
          <StatCard
            label="Delivered"
            value={campaign.delivered_count}
            pct={pct(campaign.delivered_count)}
          />
          <StatCard label="Read" value={campaign.read_count} pct={pct(campaign.read_count)} />
          <StatCard
            label="Failed"
            value={campaign.failed_count}
            pct={pct(campaign.failed_count)}
            danger
          />
        </div>

        {/* Cost */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Spent so far</p>
            <p className="text-2xl font-semibold">{formatMoney(campaign.actual_cost)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Estimated total</p>
            <p className="text-lg font-medium">{formatMoney(campaign.estimated_cost)}</p>
          </div>
        </div>

        {/* Recipients table */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
          <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
            <h2 className="font-semibold">Recipients</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">Phone</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Sent</th>
                  <th className="text-left px-4 py-2">Delivered</th>
                  <th className="text-left px-4 py-2">Read</th>
                  <th className="text-left px-4 py-2">Cost</th>
                  <th className="text-left px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-200 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2 font-mono">{r.phone}</td>
                    <td className={`px-4 py-2 capitalize ${STATUS_COLOR[r.status] ?? ''}`}>
                      {r.status}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {r.sent_at ? new Date(r.sent_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {r.read_at ? new Date(r.read_at).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-4 py-2">{formatMoney(r.cost)}</td>
                    <td className="px-4 py-2 text-xs text-red-600 truncate max-w-xs">
                      {r.error_message ?? ''}
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No recipients
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

function StatCard({
  label,
  value,
  pct,
  danger,
}: {
  label: string;
  value: number;
  pct?: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        danger
          ? 'border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20'
          : 'border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {pct !== undefined && <p className="text-xs text-gray-500 mt-0.5">{pct}%</p>}
    </div>
  );
}
