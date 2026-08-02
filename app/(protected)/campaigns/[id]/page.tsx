'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Users, Send, CheckCircle2, Eye, MessageSquare,
  XCircle, BarChart3, Layers, RefreshCcw, Ban, AlertCircle,
} from 'lucide-react';
import {
  getCampaign, getSequence, listCampaignRecipients, listEnrollments,
  getSequenceAnalytics, cancelCampaign, launchCampaign,
  pauseEnrollment, resumeEnrollment, cancelEnrollment,
  updateAutoEnrollConfig,
  type Campaign, type Sequence, type CampaignRecipient, type Enrollment,
  type SequenceAnalytics,
} from '@/services/campaigns';
import { formatDateTime } from '@/lib/format-date';
import PinToSystemButton from '@/components/system-builder/PinToSystemButton';

type Tab = 'overview' | 'steps' | 'recipients' | 'analytics';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  sending:   { label: 'Sending',   className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  active:    { label: 'Active',    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  failed:    { label: 'Failed',    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  archived:  { label: 'Archived',  className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-500' },
  sent:      { label: 'Sent',      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  delivered: { label: 'Delivered', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  read:      { label: 'Read',      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  replied:   { label: 'Replied',   className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pending:   { label: 'Pending',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  skipped:   { label: 'Skipped',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  paused:    { label: 'Paused',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
};

function Badge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;

  const isSequenceView = rawId.startsWith('seq-');
  const entityId = isSequenceView ? parseInt(rawId.replace('seq-', '')) : parseInt(rawId);

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  // Campaign state
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);

  // Sequence state
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [analytics, setAnalytics] = useState<SequenceAnalytics | null>(null);

  useEffect(() => {
    load();
  }, [rawId]);

  async function load() {
    setLoading(true);
    try {
      if (isSequenceView) {
        const [seq, enr, ana] = await Promise.all([
          getSequence(entityId),
          listEnrollments({ sequence_id: entityId }),
          getSequenceAnalytics(entityId).catch(() => null),
        ]);
        setSequence(seq);
        setEnrollments(enr);
        setAnalytics(ana);
      } else {
        const [camp, recs] = await Promise.all([
          getCampaign(entityId),
          listCampaignRecipients(entityId).catch(() => []),
        ]);
        setCampaign(camp);
        setRecipients(recs);
      }
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  const entityName = isSequenceView ? sequence?.name : campaign?.name;
  const entityStatus = isSequenceView ? sequence?.status : campaign?.status;
  const stepCount = isSequenceView ? (sequence?.steps.length || 0) : 1;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'steps', label: 'Steps', count: stepCount },
    { key: 'recipients', label: isSequenceView ? 'Enrollments' : 'Recipients', count: isSequenceView ? enrollments.length : recipients.length },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Back + header */}
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3"
      >
        <ArrowLeft className="w-4 h-4" /> All campaigns
      </button>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{entityName || 'Campaign'}</h1>
          {entityStatus && <Badge status={entityStatus} />}
          <span className="text-xs text-text-secondary bg-surface-secondary px-2 py-0.5 rounded">
            {stepCount === 1 ? 'Blast' : `${stepCount} steps`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PinToSystemButton labelHint={entityName || undefined} />
          <button onClick={load} className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-secondary">
            <RefreshCcw className="w-4 h-4" />
          </button>
          {!isSequenceView && campaign?.status === 'draft' && (
            <button
              onClick={async () => { await launchCampaign(entityId); load(); }}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium"
            >
              Launch
            </button>
          )}
          {!isSequenceView && ['sending', 'scheduled'].includes(campaign?.status || '') && (
            <button
              onClick={async () => { await cancelCampaign(entityId); load(); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/15 transition"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats row (campaign) */}
      {!isSequenceView && campaign && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Recipients', value: campaign.total_recipients, icon: Users, color: '' },
            { label: 'Sent', value: campaign.sent_count, icon: Send, color: 'text-blue-600' },
            { label: 'Delivered', value: campaign.delivered_count, icon: CheckCircle2, color: 'text-teal-600' },
            { label: 'Read', value: campaign.read_count, icon: Eye, color: 'text-green-600' },
            { label: 'Replied', value: campaign.replied_count, icon: MessageSquare, color: 'text-emerald-600' },
            { label: 'Failed', value: campaign.failed_count, icon: XCircle, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface-secondary rounded-xl p-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color || 'text-text-secondary'}`} />
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-[10px] text-text-secondary">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stats row (sequence) */}
      {isSequenceView && analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Enrolled', value: analytics.total_enrolled },
            { label: 'Active', value: analytics.active },
            { label: 'Completed', value: `${analytics.completed} (${analytics.completion_rate}%)` },
            { label: 'Reply rate', value: `${analytics.overall_reply_rate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface-secondary rounded-xl p-3 text-center">
              <div className="text-lg font-semibold">{value}</div>
              <div className="text-[10px] text-text-secondary">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs — pill segmented control */}
      <div className="inline-flex bg-surface-secondary rounded-lg p-0.5 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
              tab === t.key
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-surface text-text-secondary'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-3 text-sm">
          {!isSequenceView && campaign && (
            <>
              <Row label="Category" value={campaign.category} />
              <Row label="Schedule" value={campaign.schedule_type} />
              <Row label="Credits used" value={String(campaign.sent_count)} />
              {campaign.launched_at && <Row label="Launched" value={formatDateTime(campaign.launched_at)} />}
              {campaign.completed_at && <Row label="Completed" value={formatDateTime(campaign.completed_at)} />}
              <Row label="Created" value={formatDateTime(campaign.created_at)} />
            </>
          )}
          {isSequenceView && sequence && (
            <>
              {sequence.description && <Row label="Description" value={sequence.description} />}
              <Row label="On reply" value={sequence.on_reply} />
              <Row label="Timezone" value={sequence.timezone} />
              <Row label="Steps" value={String(sequence.steps.length)} />
              {sequence.created_at && <Row label="Created" value={formatDateTime(sequence.created_at)} />}

              {/* Auto-enroll settings card */}
              <div className="mt-4 bg-surface-secondary rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold">Auto-enroll</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-text-secondary">{sequence.auto_enroll_enabled ? 'On' : 'Off'}</span>
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${sequence.auto_enroll_enabled ? 'bg-accent' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sequence.auto_enroll_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      <input
                        type="checkbox"
                        checked={sequence.auto_enroll_enabled}
                        onChange={async (e) => {
                          await updateAutoEnrollConfig(sequence.id, { auto_enroll_enabled: e.target.checked });
                          load();
                        }}
                        className="sr-only"
                      />
                    </div>
                  </label>
                </div>
                {sequence.auto_enroll_enabled && (
                  <div className="space-y-2 text-sm mt-3 pt-3 border-t border-white/5">
                    <Row label="Source" value={
                      sequence.auto_enroll_source_type
                        ? `${sequence.auto_enroll_source_type} #${sequence.auto_enroll_source_id}`
                        : 'Not configured'
                    } />
                    <Row label="Max per day" value={String(sequence.auto_enroll_max_per_day)} />
                    <Row label="Monthly cap" value={sequence.auto_enroll_monthly_cap ? String(sequence.auto_enroll_monthly_cap) : 'Unlimited'} />
                    <Row label="Batch threshold" value={String(sequence.auto_enroll_batch_confirm_threshold)} />
                    <Row label="Today" value={String(sequence.auto_enroll_today_count)} />
                    <Row label="This month" value={String(sequence.auto_enroll_month_count)} />
                    {sequence.auto_enroll_paused_reason && (
                      <div className="flex items-center gap-2 mt-2 p-2.5 bg-amber-500/10 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-medium text-amber-400">
                            Paused: {sequence.auto_enroll_paused_reason === 'low_credits' ? 'Low credits' : sequence.auto_enroll_paused_reason === 'monthly_cap' ? 'Monthly cap reached' : 'Batch confirmation needed'}
                          </span>
                          {sequence.auto_enroll_paused_reason === 'batch_confirm' && (
                            <button
                              onClick={async () => {
                                await updateAutoEnrollConfig(sequence.id, { auto_enroll_enabled: true });
                                load();
                              }}
                              className="ml-2 text-xs text-accent underline"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'steps' && (
        <div className="space-y-3">
          {isSequenceView && sequence?.steps.map((step) => (
            <div key={step.id} className="bg-surface-secondary rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {step.step_number}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {step.step_number === 1
                      ? 'Send on enrollment'
                      : `${step.delay_days}d ${step.delay_hours}h after step ${step.step_number - 1}`}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {step.send_window_start}–{step.send_window_end}
                    {step.skip_weekends && ' · Skip weekends'}
                  </div>
                </div>
              </div>
              {step.template_name && (
                <div className="bg-surface/60 rounded-xl p-2.5 text-xs">
                  <div className="font-medium mb-0.5">{step.template_name}</div>
                  <div className="text-text-secondary line-clamp-2">{step.template_body}</div>
                </div>
              )}
            </div>
          ))}
          {!isSequenceView && campaign && (
            <div className="bg-surface-secondary rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium flex-shrink-0">1</div>
                <div>
                  <div className="text-sm font-medium">Single blast</div>
                  <div className="text-xs text-text-secondary capitalize">{campaign.category} template</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'recipients' && !isSequenceView && (
        <div className="bg-surface-secondary rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/15">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Contact</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Sent</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recipients.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sm">{r.lead_name || r.phone}</div>
                    {r.lead_name && <div className="text-xs text-text-secondary">{r.phone}</div>}
                  </td>
                  <td className="px-4 py-2.5"><Badge status={r.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {r.sent_at ? formatDateTime(r.sent_at) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-red-500 max-w-xs truncate">
                    {r.error_message || '—'}
                  </td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-text-secondary">No recipients yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'recipients' && isSequenceView && (
        <div className="bg-surface-secondary rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/15">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Contact</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Step</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Next send</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sm">{e.lead_name || e.lead_phone || `Contact #${e.lead_id}`}</div>
                    {e.lead_name && e.lead_phone && <div className="text-xs text-text-secondary">{e.lead_phone}</div>}
                  </td>
                  <td className="px-4 py-2.5"><Badge status={e.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{e.current_step} / {e.total_steps}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {e.next_send_at ? formatDateTime(e.next_send_at) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {e.status === 'active' && (
                        <button
                          onClick={async () => { await pauseEnrollment(e.id); load(); }}
                          className="text-xs px-2 py-1 bg-surface/70 rounded-md hover:bg-surface transition"
                        >
                          Pause
                        </button>
                      )}
                      {e.status === 'paused' && (
                        <button
                          onClick={async () => { await resumeEnrollment(e.id); load(); }}
                          className="text-xs px-2 py-1 bg-surface/70 rounded-md hover:bg-surface transition"
                        >
                          Resume
                        </button>
                      )}
                      {['active', 'paused'].includes(e.status) && (
                        <button
                          onClick={async () => { await cancelEnrollment(e.id); load(); }}
                          className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/15 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-text-secondary">No enrollments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'analytics' && isSequenceView && analytics && (
        <div>
          <h3 className="text-sm font-medium mb-3">Step funnel</h3>
          <div className="space-y-3">
            {analytics.steps.map((step) => {
              const maxSent = Math.max(...analytics.steps.map((s) => s.sent_count), 1);
              const barWidth = (step.sent_count / maxSent) * 100;
              return (
                <div key={step.step_number} className="bg-surface-secondary rounded-xl p-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">Step {step.step_number}</span>
                    <span className="text-xs text-text-secondary">
                      {step.sent_count} sent · {step.reply_count} replied ({step.reply_rate}%)
                      {step.failed_count > 0 && ` · ${step.failed_count} failed`}
                    </span>
                  </div>
                  <div className="h-2 bg-surface/60 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'analytics' && !isSequenceView && campaign && (
        <div className="text-center py-12 text-text-secondary">
          <BarChart3 className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Delivery analytics for blast campaigns</p>
          <p className="text-xs mt-1">
            {campaign.sent_count} sent · {campaign.delivered_count} delivered · {campaign.read_count} read · {campaign.replied_count} replied
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
