'use client';
/**
 * Per-rule audit log — every FollowUpMessage produced by this rule.
 * Shows: contact, scheduled/sent time, status, mode (free/template), cost, error reason.
 *
 * Filterable by status. Lets the operator cancel pending or send-now manually.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import {
  listRuleMessages,
  listFollowupRules,
  cancelFollowup,
  sendFollowupNow,
  formatMoney,
  statusBadgeClasses,
  type FollowUpMessage,
  type FollowUpRule,
  type FollowUpStatus,
} from '@/services/followups';

const STATUS_FILTERS: Array<{ key: '' | FollowUpStatus; label: string }> = [
  { key: '', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'pending_manual', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function RuleMessagesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = parseInt(params?.id ?? '');

  const [rule, setRule] = useState<FollowUpRule | null>(null);
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [filter, setFilter] = useState<'' | FollowUpStatus>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [rulesList, msgsRes] = await Promise.all([
        listFollowupRules(),
        listRuleMessages(id, { status: filter || undefined, limit: 200 }),
      ]);
      setRule(rulesList.find((r) => r.id === id) || null);
      setMessages(msgsRes.items || []);
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [id, filter]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (m: FollowUpMessage) => {
    if (!confirm(`Cancel scheduled follow-up #${m.id}?`)) return;
    setBusy(m.id);
    try {
      const updated = await cancelFollowup(m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || 'Cancel failed');
    } finally { setBusy(null); }
  };

  const handleSendNow = async (m: FollowUpMessage) => {
    setBusy(m.id);
    try {
      const updated = await sendFollowupNow(m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e: any) {
      setError(e?.message || 'Send failed');
    } finally { setBusy(null); }
  };

  return (
    <PermissionGuard permission="manage_settings">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Audit: {rule?.name ?? `Rule #${id}`}
            </h1>
            <p className="text-sm text-text-secondary">
              Every follow-up this rule has created.
            </p>
          </div>
          <Link
            href={`/automation/followups/${id}`}
            className="text-sm text-accent hover:underline"
          >
            ← Edit rule
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs ${
                filter === f.key
                  ? 'bg-accent text-white'
                  : 'border border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
            {error}{' '}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="h-64 animate-pulse rounded-lg bg-bg-secondary" />
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-color bg-bg-primary p-10 text-center">
            <p className="text-sm text-text-secondary">
              No follow-ups yet from this rule{filter ? ` with status "${filter}"` : ''}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-color bg-bg-primary">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {messages.map((m) => (
                  <tr key={m.id} className="hover:bg-bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs">#{m.id}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${m.contact_id ?? m.lead_id ?? ''}`}
                        className="text-text-primary hover:text-accent"
                      >
                        Contact #{m.contact_id ?? m.lead_id ?? '—'}
                      </Link>
                      {m.ai_triggered && (
                        <span className="ml-2 inline-flex items-center rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400">
                          🤖 AI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(m.status)}`}>
                        {m.status}
                      </span>
                      {m.status === 'failed' && m.meta?.last_error && (
                        <p className="mt-1 line-clamp-1 max-w-xs text-xs text-red-600 dark:text-red-400" title={m.meta.last_error}>
                          {m.meta.last_error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {m.actual_send_mode || m.planned_send_mode || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {m.window_state === 'in_window' ? '🟢 open' :
                       m.window_state === 'out_of_window' ? '🔴 closed' :
                       m.window_state || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {Number(m.actual_cost ?? 0) > 0 ? formatMoney(m.actual_cost ?? 0) :
                       Number(m.estimated_cost ?? 0) > 0 ? <span className="text-text-secondary">~{formatMoney(m.estimated_cost ?? 0)}</span> :
                       <span className="text-emerald-600">free</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(m.scheduled_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {m.sent_at ? new Date(m.sent_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(m.status === 'scheduled' || m.status === 'pending_manual') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendNow(m)}
                            disabled={busy === m.id}
                            className="mr-3 text-xs text-accent hover:underline disabled:opacity-50"
                          >
                            Send now
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(m)}
                            disabled={busy === m.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
