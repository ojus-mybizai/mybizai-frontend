'use client';

/**
 * Campaign Detail — live stats + rich recipient table.
 *
 * Shows per-recipient delivery status, send times, reply times,
 * resolved parameter values, and detailed failure reasons.
 * Auto-refreshes every 5s while campaign is 'sending'.
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
import { apiFetch } from '@/lib/api-client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Eye,
  Reply,
  Send,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Ban,
  User,
  Info,
} from 'lucide-react';

// ─── Helpers ──

function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTs(ts: string | null, opts?: { dateTime?: boolean }): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (opts?.dateTime) {
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function relativeTime(ts: string | null): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Meta error help ──

const BILLING_ERROR_CODES = new Set(['131042', '131043', '131031']);

const META_ERROR_HELP: Record<string, { title: string; body: string; action?: { label: string; href: string } }> = {
  '131042': {
    title: 'Payment issue — no valid payment method',
    body: 'Your Meta Business Account has no valid payment method or your last payment failed.',
    action: { label: 'Fix at Meta Billing', href: 'https://business.facebook.com/billing' },
  },
  '131043': {
    title: 'Payment account not found',
    body: 'Your WABA is not linked to a Meta Business Manager with a payment method.',
    action: { label: 'Open Meta Business Manager', href: 'https://business.facebook.com' },
  },
  '131031': {
    title: 'Account locked',
    body: 'Your Meta account has been locked. Check WhatsApp Manager → Account Health.',
    action: { label: 'WhatsApp Manager', href: 'https://business.facebook.com/wa/manage/' },
  },
  '131008': {
    title: 'Template name / language mismatch',
    body: 'Meta cannot find the template with the given name + language code on this WABA. Common causes: (1) Template was approved on a different WABA than the sending channel. (2) Language code mismatch — e.g. template approved as "en" but sent as "en_US". (3) Template name has a typo or wrong casing. Check the diagnostic detail below.',
    action: { label: 'Open WhatsApp Manager Templates', href: 'https://business.facebook.com/wa/manage/message-templates/' },
  },
  '132000': {
    title: 'Template not found on Meta',
    body: 'The template may have been deleted from WhatsApp Manager or not yet synced. Try syncing template status.',
  },
  '132001': {
    title: 'Template variable error',
    body: 'One or more template variables could not be resolved. Check the parameter mapping in your template.',
  },
  '132012': {
    title: 'Wrong number of variables',
    body: 'The number of variables sent does not match the template. Re-configure parameter mapping.',
  },
  'template_build_error': {
    title: 'Template configuration error',
    body: 'The template could not be built for sending. Check the error detail below — the most common cause is a URL button with a dynamic parameter that has no source configured. Open the template editor → Parameter Mapping and set the button source.',
    action: { label: 'Open Templates', href: '/message-templates' },
  },
  'no_meta_template_name': {
    title: 'Template name missing',
    body: 'Template has no Meta template name. Open the template and fill in the name field.',
  },
};

// ─── Status config ──

type RecipientStatus =
  | 'pending' | 'scheduled' | 'sending' | 'sent'
  | 'delivered' | 'read' | 'replied' | 'failed' | 'skipped';

const STATUS_CONFIG: Record<RecipientStatus, { label: string; icon: React.ReactNode; cls: string; rowCls: string }> = {
  pending:   { label: 'Pending',   icon: <Clock className="h-3 w-3" />,        cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30',    rowCls: '' },
  scheduled: { label: 'Scheduled', icon: <Clock className="h-3 w-3" />,        cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', rowCls: '' },
  sending:   { label: 'Sending',   icon: <Loader2 className="h-3 w-3 animate-spin" />, cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30', rowCls: '' },
  sent:      { label: 'Sent',      icon: <Send className="h-3 w-3" />,         cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    rowCls: '' },
  delivered: { label: 'Delivered', icon: <CheckCircle2 className="h-3 w-3" />, cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30',   rowCls: '' },
  read:      { label: 'Read',      icon: <Eye className="h-3 w-3" />,          cls: 'bg-green-500/15 text-green-400 border-green-500/30', rowCls: 'bg-green-500/3' },
  replied:   { label: 'Replied',   icon: <Reply className="h-3 w-3" />,        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', rowCls: 'bg-emerald-500/5' },
  failed:    { label: 'Failed',    icon: <XCircle className="h-3 w-3" />,      cls: 'bg-red-500/15 text-red-400 border-red-500/30',      rowCls: 'bg-red-500/3' },
  skipped:   { label: 'Skipped',   icon: <Ban className="h-3 w-3" />,          cls: 'bg-gray-500/10 text-gray-500 border-gray-500/20',   rowCls: 'opacity-50' },
};

const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  scheduled: { label: 'Scheduled', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  sending:   { label: 'Live',      cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completed', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  failed:    { label: 'Failed',    cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// ─── Recipient row component ──

function RecipientRow({ r }: { r: CampaignRecipient }) {
  const [expanded, setExpanded] = useState(false);
  const status = (r.status as RecipientStatus) ?? 'pending';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const errorHelp = r.error_code ? META_ERROR_HELP[r.error_code] : null;
  const isFailed = status === 'failed';
  const hasParams = r.resolved_params && (
    (r.resolved_params.body?.length ?? 0) > 0 ||
    (r.resolved_params.header?.length ?? 0) > 0
  );
  const hasDetail = isFailed || hasParams || r.wa_message_id;

  return (
    <>
      <tr
        className={`border-t border-border-color/50 hover:bg-hover-bg/50 transition-colors ${cfg.rowCls}`}
        onClick={() => hasDetail && setExpanded((e) => !e)}
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        {/* Expand toggle */}
        <td className="px-3 py-2.5 w-6">
          {hasDetail ? (
            <span className="text-text-secondary opacity-50">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
          ) : null}
        </td>

        {/* Contact */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-border-color/60 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-text-secondary" />
            </div>
            <div className="min-w-0">
              {r.lead_name && (
                <p className="text-xs font-medium text-text-primary truncate">{r.lead_name}</p>
              )}
              <p className="font-mono text-[11px] text-text-secondary">{r.phone}</p>
            </div>
          </div>
        </td>

        {/* Status badge */}
        <td className="px-3 py-2.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
            {cfg.icon} {cfg.label}
          </span>
        </td>

        {/* Sent */}
        <td className="px-3 py-2.5 text-[11px] text-text-secondary whitespace-nowrap">
          {r.sent_at ? (
            <span title={new Date(r.sent_at).toLocaleString()}>
              {formatTs(r.sent_at)}
              <br />
              <span className="text-[10px] opacity-60">{relativeTime(r.sent_at)}</span>
            </span>
          ) : '—'}
        </td>

        {/* Delivered */}
        <td className="px-3 py-2.5 text-[11px] text-text-secondary whitespace-nowrap">
          {r.delivered_at ? (
            <span className="text-teal-400" title={new Date(r.delivered_at).toLocaleString()}>
              {formatTs(r.delivered_at)}
            </span>
          ) : '—'}
        </td>

        {/* Read */}
        <td className="px-3 py-2.5 text-[11px] text-text-secondary whitespace-nowrap">
          {r.read_at ? (
            <span className="text-green-400" title={new Date(r.read_at).toLocaleString()}>
              {formatTs(r.read_at)}
            </span>
          ) : '—'}
        </td>

        {/* Replied */}
        <td className="px-3 py-2.5 text-[11px] whitespace-nowrap">
          {r.replied_at ? (
            <span className="text-emerald-400 font-medium" title={new Date(r.replied_at).toLocaleString()}>
              {formatTs(r.replied_at)} ↩
            </span>
          ) : '—'}
        </td>

        {/* Error / cost */}
        <td className="px-3 py-2.5 text-[11px] max-w-[200px]">
          {isFailed ? (
            <div className="text-red-400 truncate" title={r.error_message ?? ''}>
              {errorHelp?.title ?? r.error_message ?? `Error ${r.error_code}`}
            </div>
          ) : (
            <span className="text-text-secondary">{formatMoney(r.cost)}</span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={`border-t border-border-color/30 ${cfg.rowCls}`}>
          <td />
          <td colSpan={7} className="px-4 pb-3 pt-1">
            <div className="space-y-2.5 text-xs">

              {/* Error detail */}
              {isFailed && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                    <XCircle className="h-3.5 w-3.5" />
                    {errorHelp?.title ?? `Error ${r.error_code ?? 'unknown'}`}
                  </div>
                  <p className="text-red-300/80 leading-relaxed">
                    {errorHelp?.body ?? r.error_message ?? 'No error details available.'}
                  </p>

                  {/* Diagnostic: parse [sent name=... lang=...] and [WABA MISMATCH] from error_message */}
                  {r.error_message && (() => {
                    const sentMatch = r.error_message.match(/\[sent name=('([^']*)'|"([^"]*)") lang=('([^']*)'|"([^"]*)")\]/);
                    const wabaMismatch = r.error_message.includes('[WABA MISMATCH');
                    const wabaMismatchDetail = r.error_message.match(/\[WABA MISMATCH: ([^\]]+)\]/)?.[1];
                    const sentName = sentMatch?.[2] ?? sentMatch?.[3];
                    const sentLang = sentMatch?.[5] ?? sentMatch?.[6];
                    if (!sentName && !wabaMismatch) return null;
                    return (
                      <div className="mt-2 space-y-1.5 border-t border-red-500/20 pt-2">
                        <p className="text-red-400/80 text-[10px] font-semibold uppercase tracking-wide">Diagnostic</p>
                        {sentName && (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                            <span className="text-red-400/50">Template name sent:</span>
                            <span className="text-red-300">{sentName}</span>
                            <span className="text-red-400/50">Language code sent:</span>
                            <span className="text-red-300">{sentLang}</span>
                          </div>
                        )}
                        {wabaMismatch && (
                          <div className="flex items-start gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              <strong>WABA mismatch:</strong> {wabaMismatchDetail ?? 'Template was submitted to a different WABA than the sending channel.'}
                            </span>
                          </div>
                        )}
                        <p className="text-red-400/40 text-[10px]">
                          To fix: open the template in WhatsApp Manager and verify the name and language match exactly what is stored here.
                          {wabaMismatch && ' Also ensure the template is submitted to the same WABA as the campaign channel.'}
                        </p>
                      </div>
                    );
                  })()}

                  {r.error_code && (
                    <p className="text-red-400/50 text-[10px]">Error code: {r.error_code}</p>
                  )}
                  {errorHelp?.action && (
                    <a
                      href={errorHelp.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-500 transition-colors mt-1"
                    >
                      {errorHelp.action.label} →
                    </a>
                  )}
                </div>
              )}

              {/* Resolved parameter values */}
              {hasParams && (
                <div className="rounded-lg border border-border-color/60 bg-card-bg/60 p-3">
                  <p className="text-text-secondary font-semibold mb-1.5 flex items-center gap-1.5">
                    <Info className="h-3 w-3" />
                    Variables sent with this message
                  </p>
                  <div className="space-y-1">
                    {(r.resolved_params?.header ?? []).map((v, i) => (
                      <div key={`h${i}`} className="flex items-center gap-2">
                        <span className="rounded bg-border-color/60 px-1.5 py-px text-[10px] font-mono text-text-secondary shrink-0">header {`{{${i + 1}}}`}</span>
                        <span className="text-text-primary truncate">{v || <em className="text-text-secondary">empty</em>}</span>
                      </div>
                    ))}
                    {(r.resolved_params?.body ?? []).map((v, i) => (
                      <div key={`b${i}`} className="flex items-center gap-2">
                        <span className="rounded bg-border-color/60 px-1.5 py-px text-[10px] font-mono text-text-secondary shrink-0">body {`{{${i + 1}}}`}</span>
                        <span className="text-text-primary truncate">{v || <em className="text-text-secondary">empty — source not configured</em>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp message ID */}
              {r.wa_message_id && (
                <p className="text-text-secondary">
                  WA Message ID:{' '}
                  <span className="font-mono text-text-primary">{r.wa_message_id}</span>
                </p>
              )}

              {/* Timeline */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                {r.sent_at && <span>Sent: <span className="text-text-primary">{formatTs(r.sent_at, { dateTime: true })}</span></span>}
                {r.delivered_at && <span>Delivered: <span className="text-teal-400">{formatTs(r.delivered_at, { dateTime: true })}</span></span>}
                {r.read_at && <span>Read: <span className="text-green-400">{formatTs(r.read_at, { dateTime: true })}</span></span>}
                {r.replied_at && <span>Replied: <span className="text-emerald-400 font-medium">{formatTs(r.replied_at, { dateTime: true })}</span></span>}
                {r.failed_at && <span>Failed: <span className="text-red-400">{formatTs(r.failed_at, { dateTime: true })}</span></span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main page ──

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Number(params?.campaignId);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateDebug, setTemplateDebug] = useState<Record<string, unknown> | null>(null);
  const [templateDebugLoading, setTemplateDebugLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        getCampaign(campaignId),
        listCampaignRecipients(campaignId, { limit: 500 }),
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

  const handleTemplateDebug = async (templateId: number) => {
    setTemplateDebugLoading(true);
    setTemplateDebug(null);
    try {
      const result = await apiFetch<Record<string, unknown>>(
        `/campaigns/template-debug/${templateId}`,
        { method: 'GET' }
      );
      setTemplateDebug(result);
    } catch (err) {
      setTemplateDebug({ error: err instanceof Error ? err.message : 'Failed to load debug info' });
    } finally {
      setTemplateDebugLoading(false);
    }
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-60">
        {error
          ? <p className="text-red-400">{error}</p>
          : <Loader2 className="h-6 w-6 animate-spin text-accent" />}
      </div>
    );
  }

  const total = campaign.total_recipients || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const campaignStatusCfg = CAMPAIGN_STATUS_CONFIG[campaign.status] ?? CAMPAIGN_STATUS_CONFIG.draft;

  // Billing halt detection
  const billingRecipient = recipients.find((r) => r.error_code && BILLING_ERROR_CODES.has(r.error_code));

  // Filtered recipients
  const visibleRecipients = statusFilter === 'all'
    ? recipients
    : recipients.filter((r) => r.status === statusFilter);

  // Status distribution for filter pills
  const statusCounts: Record<string, number> = { all: recipients.length };
  for (const r of recipients) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div>
          <Link href="/outbound" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Outbound Hub
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full border border-border-color px-2 py-0.5 text-[11px] text-text-secondary capitalize">
                  {campaign.category}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${campaignStatusCfg.cls}`}>
                  {campaign.status === 'sending' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {campaignStatusCfg.label}
                </span>
                {campaign.launched_at && (
                  <span className="text-[11px] text-text-secondary">
                    Launched {formatTs(campaign.launched_at, { dateTime: true })}
                  </span>
                )}
                {campaign.completed_at && (
                  <span className="text-[11px] text-text-secondary">
                    · Completed {formatTs(campaign.completed_at, { dateTime: true })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={load}
                className="rounded-lg border border-border-color p-2 text-text-secondary hover:bg-hover-bg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {/* Template debug — shown when any 131008 failures exist */}
              {recipients.some((r) => r.error_code === '131008' || r.error_code === 'template_build_error') && (
                <button
                  onClick={() => handleTemplateDebug(campaign.template_id)}
                  disabled={templateDebugLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
                  title="Diagnose template name / language / WABA mismatch"
                >
                  {templateDebugLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Info className="h-3.5 w-3.5" />}
                  Check Template
                </button>
              )}
              {(campaign.status === 'sending' || campaign.status === 'scheduled') && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/8 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  {cancelling ? 'Cancelling…' : 'Cancel Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Billing error banner */}
        {billingRecipient?.error_code && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/8 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400 text-sm">
                  Campaign halted — {META_ERROR_HELP[billingRecipient.error_code]?.title ?? `Meta error ${billingRecipient.error_code}`}
                </p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  {META_ERROR_HELP[billingRecipient.error_code]?.body ?? billingRecipient.error_message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {META_ERROR_HELP[billingRecipient.error_code]?.action && (
                <a
                  href={META_ERROR_HELP[billingRecipient.error_code]!.action!.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-500"
                >
                  {META_ERROR_HELP[billingRecipient.error_code]!.action!.label} →
                </a>
              )}
              <span className="text-[11px] text-red-400/60">
                Code: {billingRecipient.error_code} · {recipients.filter((r) => r.error_code === billingRecipient.error_code).length} affected
              </span>
            </div>
          </div>
        )}

        {/* Localhost / webhook warning — shown when any messages are stuck at "sent" */}
        {recipients.some((r) => r.status === 'sent') &&
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex items-start gap-2.5 text-xs text-blue-300">
            <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-300">Running locally — delivery/read statuses won&apos;t update</p>
              <p className="text-blue-400/70">
                Meta cannot send webhook callbacks to localhost. Messages marked <strong>Sent</strong> may have been delivered to the phone,
                but your server won&apos;t receive the delivery confirmation.
                Use <strong>ngrok</strong> and set the callback URL in Meta Developer Console → WhatsApp → Configuration → Webhook.
              </p>
              <p className="text-blue-400/50">
                Webhook URL: <span className="font-mono">https://your-ngrok-url.ngrok.io/api/v1/meta/webhook</span>
                {' · '}Verify token: <span className="font-mono">mysecretverifytoken</span>
              </p>
            </div>
          </div>
        )}

        {/* Template debug panel */}
        {templateDebug && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-amber-400 text-sm">Template Diagnostic</span>
              </div>
              <button onClick={() => setTemplateDebug(null)} className="text-amber-400/60 hover:text-amber-400 text-xs">✕</button>
            </div>

            {'error' in templateDebug ? (
              <p className="text-xs text-red-400">{String(templateDebug.error)}</p>
            ) : (
              <div className="space-y-2 text-xs">
                {/* Key values */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono">
                  {[
                    ['Meta template name (sent to Meta)', templateDebug.meta_template_name],
                    ['Language code (sent to Meta)', templateDebug.language_that_will_be_sent],
                    ['Language stored in DB', templateDebug.language_stored],
                    ['Template status', templateDebug.meta_status],
                    ['Template WABA', templateDebug.meta_waba_id],
                    ['Channel WABA', templateDebug.pinned_channel_waba_id],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="contents">
                      <span className="text-amber-400/60">{String(label)}</span>
                      <span className={`font-medium ${val ? 'text-amber-200' : 'text-red-400'}`}>
                        {val ? String(val) : '(empty)'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* WABA mismatch alert */}
                {templateDebug.waba_match === false && (
                  <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/25 rounded p-2 text-red-300">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
                    <span><strong>WABA mismatch detected:</strong> {String(templateDebug.waba_note)}</span>
                  </div>
                )}

                {/* Actions needed */}
                {Array.isArray(templateDebug.actions_needed) && (templateDebug.actions_needed as string[]).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-amber-400/80 font-semibold">Issues to fix:</p>
                    <ul className="space-y-0.5 list-disc list-inside text-amber-300/80">
                      {(templateDebug.actions_needed as string[]).map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* All good */}
                {templateDebug.waba_match !== false && Array.isArray(templateDebug.actions_needed) && (templateDebug.actions_needed as string[]).length === 0 && (
                  <p className="text-green-400 text-xs">
                    No issues detected. The name, language, and WABA all look correct. The problem may be that Meta approved the template with a different language code — compare the values above against WhatsApp Manager.
                  </p>
                )}

                <a
                  href="https://business.facebook.com/wa/manage/message-templates/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] text-amber-400 underline hover:text-amber-300"
                >
                  Open WhatsApp Manager Templates →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Recipients', value: campaign.total_recipients, icon: <User className="h-3 w-3" /> },
            { label: 'Sent',       value: campaign.sent_count,       pct: pct(campaign.sent_count),       icon: <Send className="h-3 w-3" />, cls: 'text-blue-400' },
            { label: 'Delivered',  value: campaign.delivered_count,  pct: pct(campaign.delivered_count),  icon: <CheckCircle2 className="h-3 w-3" />, cls: 'text-teal-400' },
            { label: 'Read',       value: campaign.read_count,       pct: pct(campaign.read_count),       icon: <Eye className="h-3 w-3" />, cls: 'text-green-400' },
            { label: 'Replied',    value: campaign.replied_count,    pct: pct(campaign.replied_count),    icon: <Reply className="h-3 w-3" />, cls: 'text-emerald-400' },
            { label: 'Failed',     value: campaign.failed_count,     pct: pct(campaign.failed_count),     icon: <XCircle className="h-3 w-3" />, cls: 'text-red-400', danger: true },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-3 ${s.danger && campaign.failed_count > 0
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-border-color bg-card-bg'}`}
            >
              <div className={`flex items-center gap-1 text-[11px] mb-1 ${s.cls ?? 'text-text-secondary'}`}>
                {s.icon} {s.label}
              </div>
              <p className={`text-xl font-bold ${s.cls ?? 'text-text-primary'}`}>{s.value}</p>
              {s.pct !== undefined && s.value > 0 && (
                <p className="text-[10px] text-text-secondary mt-0.5">{s.pct}%</p>
              )}
            </div>
          ))}
        </div>

        {/* Cost card */}
        <div className="rounded-xl border border-border-color bg-card-bg px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-secondary">Spent so far</p>
            <p className="text-xl font-bold text-text-primary">{formatMoney(campaign.actual_cost)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">Estimated total</p>
            <p className="text-base font-medium text-text-primary">{formatMoney(campaign.estimated_cost)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-secondary">Per message</p>
            <p className="text-base font-medium text-text-primary">{formatMoney(campaign.cost_per_message)}</p>
          </div>
        </div>

        {/* Recipients table */}
        <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
          {/* Table header + filter pills */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-color flex-wrap">
            <h2 className="text-sm font-semibold text-text-primary">
              Recipients
              {visibleRecipients.length !== recipients.length && (
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  ({visibleRecipients.length} shown)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['all', 'sent', 'delivered', 'read', 'replied', 'failed', 'pending', 'skipped'].map((s) => {
                const count = statusCounts[s] ?? 0;
                if (s !== 'all' && count === 0) return null;
                const cfg = s !== 'all' ? STATUS_CONFIG[s as RecipientStatus] : null;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-accent text-white border-accent'
                        : `border-border-color text-text-secondary hover:border-accent/40 ${cfg?.cls ?? ''}`
                    }`}
                  >
                    {cfg?.icon} {s === 'all' ? 'All' : (cfg?.label ?? s)} ({s === 'all' ? recipients.length : count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Click-to-expand hint */}
          <div className="px-4 py-1.5 text-[10px] text-text-secondary border-b border-border-color/40 bg-hover-bg/30">
            Click a row to see error details, variable values, and full timestamps
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-hover-bg/50 border-b border-border-color">
                <tr className="text-[10px] uppercase text-text-secondary tracking-wide">
                  <th className="w-6" />
                  <th className="text-left px-3 py-2.5">Contact</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Sent</th>
                  <th className="text-left px-3 py-2.5">Delivered</th>
                  <th className="text-left px-3 py-2.5">Read</th>
                  <th className="text-left px-3 py-2.5">Replied</th>
                  <th className="text-left px-3 py-2.5">Error / Cost</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipients.map((r) => (
                  <RecipientRow key={r.id} r={r} />
                ))}
                {visibleRecipients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-secondary text-sm">
                      {statusFilter === 'all' ? 'No recipients yet' : `No ${statusFilter} recipients`}
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
