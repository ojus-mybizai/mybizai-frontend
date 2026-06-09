'use client';
/**
 * Follow-up Rules dashboard + list.
 *
 * Top section: cost / volume / health cards driven by /followups/analytics.
 * Below: list of all rules with toggle, edit, delete, view audit log.
 *
 * No client-side state library — useState + useEffect is enough for a list
 * of <100 rules, matching the existing automation page pattern.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import {
  listFollowupRules,
  getFollowupAnalytics,
  pauseFollowupRule,
  activateFollowupRule,
  deleteFollowupRule,
  formatDelay,
  formatMoney,
  TRIGGER_TYPE_META,
  type FollowUpRule,
  type FollowUpAnalytics,
} from '@/services/followups';
import TopupModal from '@/components/credits/topup-modal';

export default function FollowupRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [analytics, setAnalytics] = useState<FollowUpAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRuleId, setBusyRuleId] = useState<number | null>(null);
  const [showTopup, setShowTopup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([listFollowupRules(), getFollowupAnalytics()]);
      setRules(r.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)));
      setAnalytics(a);
    } catch (e: any) {
      setError(e?.message || 'Failed to load follow-up rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule: FollowUpRule) => {
    setBusyRuleId(rule.id);
    try {
      const fn = rule.is_active ? pauseFollowupRule : activateFollowupRule;
      const updated = await fn(rule.id);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (e: any) {
      setError(e?.message || 'Toggle failed');
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleDelete = async (rule: FollowUpRule) => {
    if (!confirm(`Delete rule "${rule.name}"? Pending follow-ups from this rule will be unlinked but not cancelled.`)) return;
    setBusyRuleId(rule.id);
    try {
      await deleteFollowupRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setBusyRuleId(null);
    }
  };

  return (
    <PermissionGuard permission="manage_settings">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Follow-up Rules</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Automated nudges, reminders, and reactivations. Free inside the 24h WhatsApp window,
              paid templates outside — cost-aware delivery handles the rest.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/automation/followups/new')}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + New rule
          </button>
        </div>

        {/* Dashboard cards */}
        {analytics && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CreditCard
                balance={analytics.credits_balance}
                monthlyCap={analytics.credits_monthly_cap}
                monthlyUsed={analytics.credits_monthly_used}
                onTopup={() => setShowTopup(true)}
              />
              <StatCard
                label="Active rules"
                value={`${analytics.rules_active}`}
                hint={`${analytics.rules_paused} paused`}
                tone="emerald"
              />
              <StatCard
                label="Sent today"
                value={`${analytics.messages_sent_today}`}
                hint={`${analytics.messages_scheduled} scheduled`}
                tone="blue"
              />
              <StatCard
                label="Est. Meta cost this month"
                value={formatMoney(analytics.cost_this_month, analytics.currency)}
                hint={`${analytics.sent_this_month_free_form} free + ${analytics.sent_this_month_template} templates · billed by Meta to you`}
                tone="amber"
              />
            </div>
            <p className="text-xs text-text-secondary">
              <span className="font-semibold">Credits</span> are what we charge for follow-up sends —
              1 credit per outbound template message. <span className="font-semibold">Estimated Meta cost</span> is
              what WhatsApp will bill directly to your Meta Business Account (separate from credits).
            </p>
          </>
        )}

        {/* Failures alert */}
        {analytics && analytics.messages_failed_last_24h > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
            <div className="font-semibold text-red-700 dark:text-red-400">
              {analytics.messages_failed_last_24h} follow-up{analytics.messages_failed_last_24h === 1 ? '' : 's'} failed in the last 24 hours
            </div>
            {analytics.recent_failures.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                {analytics.recent_failures.slice(0, 3).map((f) => (
                  <li key={f.id}>
                    <span className="font-mono">#{f.id}</span> {f.error ?? 'unknown error'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
            {error}{' '}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Rule list */}
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-bg-secondary" />
        ) : rules.length === 0 ? (
          <EmptyState onNew={() => router.push('/automation/followups/new')} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-color bg-bg-primary">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Delay</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {rules.map((rule) => {
                  const meta = TRIGGER_TYPE_META[rule.trigger_type];
                  return (
                    <tr key={rule.id} className="hover:bg-bg-secondary/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/automation/followups/${rule.id}`}
                          className="font-medium text-text-primary hover:text-accent"
                        >
                          {rule.name}
                        </Link>
                        {rule.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{rule.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="mr-1">{meta?.icon}</span>
                        {meta?.label || rule.trigger_type}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDelay(rule.delay_minutes)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                          {rule.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busyRuleId === rule.id}
                          onClick={() => handleToggle(rule)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            rule.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                          } ${busyRuleId === rule.id ? 'opacity-50' : ''}`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              rule.is_active ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/automation/followups/${rule.id}/messages`}
                          className="mr-3 text-xs text-text-secondary hover:text-accent"
                        >
                          Audit
                        </Link>
                        <Link
                          href={`/automation/followups/${rule.id}`}
                          className="mr-3 text-xs text-text-secondary hover:text-accent"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          disabled={busyRuleId === rule.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showTopup && (
          <TopupModal
            onClose={() => setShowTopup(false)}
            onPurchased={() => { load(); }}
          />
        )}
      </div>
    </PermissionGuard>
  );
}

/* ─── Small reusable components ───────────────────────────────────────────── */

function CreditCard({
  balance, monthlyCap, monthlyUsed, onTopup,
}: {
  balance: number;
  monthlyCap?: number | null;
  monthlyUsed: number;
  onTopup: () => void;
}) {
  const capPct = monthlyCap && monthlyCap > 0 ? Math.min(100, (monthlyUsed / monthlyCap) * 100) : 0;
  const low = balance < 100;
  return (
    <div className={`rounded-xl border bg-bg-primary p-4 border-l-4 ${
      low ? 'border-l-red-500 border-red-500/30' : 'border-l-accent border-border-color'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-text-secondary">Credits</p>
        <button
          type="button"
          onClick={onTopup}
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
            low ? 'bg-red-500 text-white' : 'bg-accent text-white'
          } hover:opacity-90`}
        >
          {low ? 'Top up now' : '+ Buy'}
        </button>
      </div>
      <p className={`mt-1 text-2xl font-bold ${low ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
        {balance.toLocaleString()}
      </p>
      {monthlyCap != null ? (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
            <div
              className={`h-full ${capPct > 90 ? 'bg-red-500' : capPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${capPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {monthlyUsed.toLocaleString()} / {monthlyCap.toLocaleString()} used this month
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-text-secondary">No monthly cap</p>
      )}
    </div>
  );
}

function StatCard({
  label, value, hint, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'primary' | 'emerald' | 'blue' | 'amber';
}) {
  const accent =
    tone === 'primary' ? 'border-l-accent' :
    tone === 'emerald' ? 'border-l-emerald-500' :
    tone === 'blue' ? 'border-l-blue-500' :
    'border-l-amber-500';
  return (
    <div className={`rounded-xl border border-border-color bg-bg-primary p-4 border-l-4 ${accent}`}>
      <p className="text-xs uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border-color bg-bg-primary p-10 text-center">
      <p className="text-base font-medium text-text-primary">No follow-up rules yet</p>
      <p className="mt-2 text-sm text-text-secondary max-w-md mx-auto">
        Create your first rule to automatically nudge silent leads, send demo reminders,
        or follow up after a pipeline stage change. Inside the 24h WhatsApp window sends
        are free; outside, a pre-approved template is used.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Create your first rule
      </button>
    </div>
  );
}
