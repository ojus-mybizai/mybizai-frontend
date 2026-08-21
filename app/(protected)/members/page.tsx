'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Phone, Shield, X, Search, MessageCircle,
  KeyRound, UserMinus, AlertTriangle, Mail, CheckCircle2, Clock, XCircle, Trash2, RefreshCw, Pencil,
} from 'lucide-react';
import {
  listMembers, createMember, updateMember, attachWhatsApp, attachPortal,
  deactivateMember, resendWhatsAppInvite, resendPortalInvite, waChannelSetupError, detachWhatsApp,
  type Member, type MemberCreatePayload, type MemberWaStatus,
} from '@/services/members';
import { listRoles, type Role } from '@/services/roles';
import { SessionWindowChip } from '@/components/tasks/shared/session-window-chip';

// The team-WhatsApp-channel setting (`wa_employee_channel_id`) was retired
// alongside the WaEmployee subsystem. Attaching WhatsApp to a member still
// works if the backend can resolve *any* WA channel; otherwise the invite
// fails loudly at attach-time. No pre-flight gate remains here.
type WaSetup = 'ready';

/**
 * India-only: user enters a 10-digit mobile number; we prefix +91 ourselves.
 * Backend expects 11–15 digits with country code, so we send "91" + digits.
 */
const WA_COUNTRY_CODE = '91';
const WA_LOCAL_LEN = 10;

function validateWaLocal(raw: string): { digits: string } | { error: string } {
  const digits = raw.replace(/\D+/g, '');
  if (digits.length === 0) return { error: 'Enter a 10-digit mobile number.' };
  if (digits.length !== WA_LOCAL_LEN) {
    return { error: `India mobile numbers are 10 digits. Got ${digits.length}.` };
  }
  return { digits: WA_COUNTRY_CODE + digits };
}

/** Strip the +91 prefix if present so an existing number pre-fills as 10 digits. */
function stripCountryCode(stored: string | null | undefined): string {
  if (!stored) return '';
  const d = stored.replace(/\D+/g, '');
  return d.startsWith(WA_COUNTRY_CODE) && d.length === WA_LOCAL_LEN + WA_COUNTRY_CODE.length
    ? d.slice(WA_COUNTRY_CODE.length)
    : d;
}

/** Render a stored WA number without hiding invalid ones behind a bare `+`. */
function FormattedWa({ raw }: { raw: string }) {
  const digits = raw.replace(/\D+/g, '');
  const looksValid = digits.length >= 11 && digits.length <= 15;
  if (looksValid) return <span className="font-mono">+{digits}</span>;
  return (
    <span
      className="font-mono text-red-600 dark:text-red-400"
      title="Number looks invalid — 10–15 digits with country code expected."
    >
      {raw}
    </span>
  );
}

/**
 * Report both invite legs after create. All-sent → success; any leg failed →
 * warning (or error if hard-failed); nothing attempted → success ("added").
 */
function buildCreateNotice(created: Member): CreateNotice {
  const waStatus = created.wa_invite_status ?? null;
  const portalStatus = created.portal_invite_status ?? null;
  const parts: string[] = [];
  let severity: 'success' | 'warning' | 'error' = 'success';
  let url: string | undefined;

  if (waStatus === 'sent') {
    parts.push(`WhatsApp invite sent to +${created.whatsapp_number}`);
  } else if (waStatus === 'no_channel') {
    parts.push(`WhatsApp invite not sent — ${created.wa_invite_detail ?? 'no team WhatsApp number is configured.'}`);
    severity = 'warning';
    url = created.wa_invite_settings_url ?? '/settings/channels';
  } else if (waStatus === 'failed') {
    parts.push(`WhatsApp rejected the invite: ${created.wa_invite_detail ?? 'unknown error'}`);
    severity = 'warning';
  }

  if (portalStatus === 'sent') {
    parts.push(`portal email sent to ${created.portal_invite_email ?? 'the address you entered'}`);
  } else if (portalStatus === 'failed') {
    parts.push(`portal email failed: ${created.portal_invite_detail ?? 'unknown error'}`);
    severity = severity === 'success' ? 'warning' : severity;
  }

  const summary = parts.length
    ? `${created.name} added — ${parts.join('; ')}.`
    : `${created.name} added.`;

  if (severity === 'success') return { kind: 'success', text: summary };
  if (severity === 'warning') return { kind: 'warning', text: summary, url };
  return { kind: 'error', text: summary };
}

// Borderless pills — one flat color surface, no outline. Lighter fills so the
// text does the talking; borders were creating visual noise in the drawer.
const PORTAL_PILL = 'bg-blue-100/70 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';

const WA_PILL: Record<MemberWaStatus, { cls: string; label: string; Icon: typeof CheckCircle2 } | null> = {
  active:        { cls: 'bg-green-100/70 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'WhatsApp verified', Icon: CheckCircle2 },
  pending:       { cls: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'WhatsApp pending',  Icon: Clock },
  declined:      { cls: 'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',         label: 'WhatsApp declined', Icon: XCircle },
  failed:        { cls: 'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',         label: 'Invite failed',     Icon: AlertTriangle },
  inactive:      { cls: 'bg-bg-secondary text-text-secondary',                                     label: 'WhatsApp inactive', Icon: XCircle },
  not_connected: null,
};

type StatusFilterKey = 'all' | 'active' | 'pending' | 'declined' | 'inactive';

/** Which Member.status values each filter chip matches. */
const STATUS_FILTERS: { key: StatusFilterKey; label: string; matches: (m: Member) => boolean }[] = [
  { key: 'all',      label: 'All',          matches: () => true },
  { key: 'active',   label: 'Active',       matches: (m) => m.is_active && m.status === 'active' },
  { key: 'pending',  label: 'Invite pending', matches: (m) => m.is_active && (m.status === 'pending_acceptance' || m.status === 'pending' || m.status === 'invite_failed') },
  { key: 'declined', label: 'Declined',     matches: (m) => m.is_active && (m.status === 'declined' || m.status === 'rejected') },
  { key: 'inactive', label: 'Deactivated',  matches: (m) => !m.is_active },
];

const STATUS_PILL: Record<string, string> = {
  active:             'bg-green-100/70 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  pending_acceptance: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  invite_failed:      'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  rejected:           'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  declined:           'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  inactive:           'bg-bg-secondary text-text-secondary',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const waSetup: WaSetup = 'ready';
  const [notice, setNotice] = useState<CreateNotice>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, r] = await Promise.all([
        listMembers(q ? { q } : undefined),
        listRoles(),
      ]);
      setMembers(m);
      setRoles(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Members</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            One place for everyone — reachable on the portal, WhatsApp, or both.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add member
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder="Search name or number..."
            className="w-full rounded-lg border border-border-secondary bg-bg-primary pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <button onClick={load} className="rounded-lg border border-border-secondary px-3 py-2 text-sm text-text-primary hover:border-accent">
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {STATUS_FILTERS.map((f) => {
          const count = members.filter(f.matches).length;
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary')
              }
            >
              {f.label}
              <span className={active ? 'opacity-80' : 'opacity-60'}>{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div
          className={
            'mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ' +
            (notice.kind === 'success'
              ? 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
              : notice.kind === 'warning'
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
              : 'border-red-300 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300')
          }
        >
          <div>
            {notice.text}
            {notice.kind === 'warning' && notice.url && (
              <>
                {' '}
                <a href={notice.url} className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                  Open WhatsApp settings
                </a>
              </>
            )}
          </div>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="rounded-lg overflow-hidden bg-bg-primary">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary/60 text-text-secondary">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Channels</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-secondary/50">
            {(() => {
              const activeFilter = STATUS_FILTERS.find((f) => f.key === statusFilter) ?? STATUS_FILTERS[0];
              const visible = members.filter(activeFilter.matches);
              if (loading) {
                return <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">Loading...</td></tr>;
              }
              if (members.length === 0) {
                return <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">No members yet — add your first one.</td></tr>;
              }
              if (visible.length === 0) {
                return <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">No members match this filter.</td></tr>;
              }
              return visible.map((m) => (
                <tr key={m.id} onClick={() => setSelected(m)} className="hover:bg-bg-secondary/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary">{m.name}</span>
                    {m.whatsapp_number && (
                      <div className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                        <Phone className="w-3 h-3" /> <FormattedWa raw={m.whatsapp_number} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {m.channels.length === 0 && <span className="text-xs text-text-secondary">—</span>}
                      {m.channels.includes('portal') && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PORTAL_PILL}`}>
                          <KeyRound className="w-3 h-3" /> Portal
                        </span>
                      )}
                      {WA_PILL[m.wa_status] && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${WA_PILL[m.wa_status]!.cls}`}>
                          {(() => { const Icon = WA_PILL[m.wa_status]!.Icon; return <Icon className="w-3 h-3" />; })()}
                          {WA_PILL[m.wa_status]!.label}
                        </span>
                      )}
                      {m.wa_status === 'active' && (
                        <SessionWindowChip
                          expiresAt={m.session_window_expires_at}
                          active={m.session_active}
                          hasWhatsapp={m.channels.includes('whatsapp')}
                          size="md"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {m.role_name ? (
                      <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" />{m.role_name}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[m.status] || 'bg-bg-secondary text-text-secondary'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateMemberModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={(warning) => { setShowCreate(false); setNotice(warning); load(); }}
          waConfigured={waSetup === 'ready'}
        />
      )}

      {selected && (
        <MemberDetail
          member={selected}
          allMembers={members}
          roles={roles}
          onClose={() => setSelected(null)}
          onChanged={(m) => { setSelected(m); load(); }}
          onDeactivated={() => { setSelected(null); load(); }}
          waSetup={waSetup}
        />
      )}
    </div>
  );
}

function MemberDetail({ member, allMembers, roles, onClose, onChanged, onDeactivated, waSetup }: {
  member: Member;
  allMembers: Member[];
  roles: Role[];
  onClose: () => void;
  onChanged: (m: Member) => void;
  onDeactivated: () => void;
  waSetup: WaSetup;
}) {
  const [email, setEmail] = useState('');
  const [editRole, setEditRole] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>(member.role_id ?? '');
  const [busy, setBusy] = useState<'portal' | 'role' | 'resend_portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasPortal = member.channels.includes('portal');

  async function addPortal() {
    if (!email.trim()) return;
    setBusy('portal'); setError(null);
    try { onChanged(await attachPortal(member.id, email.trim())); setEmail(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to add login'); }
    finally { setBusy(null); }
  }

  async function saveRole() {
    setBusy('role'); setError(null);
    try {
      const updated = await updateMember(member.id, { role_id: selectedRoleId || undefined });
      onChanged(updated);
      setEditRole(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update role'); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-secondary shadow-2xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary">
          <h2 className="text-sm font-semibold text-text-primary">Member</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{member.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {hasPortal && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PORTAL_PILL}`}>
                  <KeyRound className="w-3 h-3" /> Portal
                </span>
              )}
              {WA_PILL[member.wa_status] && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${WA_PILL[member.wa_status]!.cls}`}>
                  {(() => { const Icon = WA_PILL[member.wa_status]!.Icon; return <Icon className="w-3 h-3" />; })()}
                  {WA_PILL[member.wa_status]!.label}
                </span>
              )}
              {member.channels.length === 0 && <span className="text-xs text-text-secondary">No channels yet</span>}
            </div>

            {/* Role */}
            <div className="mt-2">
              {editRole ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 rounded-lg border border-border-secondary bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                  >
                    <option value="">No role</option>
                    {roles.filter(r => !r.is_system).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button onClick={saveRole} disabled={busy === 'role'} className="text-xs text-accent font-medium">
                    {busy === 'role' ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditRole(false)} className="text-xs text-text-secondary">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditRole(true)}
                  className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{member.role_name || 'No role'}</span>
                  <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              )}
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          {notice && <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">{notice}</div>}

          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Channels</span>

            <WhatsAppSection member={member} waSetup={waSetup} onChanged={onChanged} onNotice={setNotice} onError={setError} />

            {!hasPortal && (
              <div className="mt-3 rounded-lg bg-bg-secondary/50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <KeyRound className="w-4 h-4 text-blue-600" /> Portal login
                  <span className="text-xs font-normal text-text-secondary">— not set up</span>
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  className="w-full rounded-md border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button onClick={addPortal} disabled={busy === 'portal'} className="mt-2 w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy === 'portal' ? 'Sending invite...' : 'Send email invite'}
                </button>
              </div>
            )}

            {hasPortal && !member.has_login && (
              <div className="mt-3 rounded-lg bg-bg-secondary/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <Mail className="w-4 h-4 text-blue-600" /> Portal login
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Clock className="w-3 h-3" /> Invite pending
                  </span>
                </div>
                <button
                  onClick={async () => {
                    setBusy('resend_portal'); setError(null); setNotice(null);
                    try {
                      const res = await resendPortalInvite(member.id);
                      setNotice(res.message);
                    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to resend'); }
                    finally { setBusy(null); }
                  }}
                  disabled={busy === 'resend_portal'}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-60"
                >
                  <RefreshCw className="w-3 h-3" />
                  {busy === 'resend_portal' ? 'Sending…' : 'Resend email invite'}
                </button>
              </div>
            )}

            {member.wa_status === 'active' && hasPortal && member.has_login && (
              <p className="mt-3 text-xs text-text-secondary">This member is reachable on both channels.</p>
            )}
          </div>

          <DeactivateSection member={member} allMembers={allMembers} onDeactivated={onDeactivated} />
        </div>
      </div>
    </>
  );
}

function WhatsAppSection({ member, waSetup, onChanged, onNotice, onError }: {
  member: Member;
  waSetup: WaSetup;
  onChanged: (m: Member) => void;
  onNotice: (s: string | null) => void;
  onError: (s: string | null) => void;
}) {
  const [waNumber, setWaNumber] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'attach' | 'resend' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const setupReady = waSetup === 'ready';

  async function submitNumber() {
    const trimmed = waNumber.trim();
    if (!trimmed) return;
    const v = validateWaLocal(trimmed);
    if ('error' in v) { setFieldError(v.error); return; }
    setBusy('attach'); onError(null); onNotice(null); setFieldError(null);
    try {
      const updated = await attachWhatsApp(member.id, v.digits);
      if (updated.wa_invite_status === 'sent') {
        onNotice(`Invite sent to +${updated.whatsapp_number}. Waiting for accept.`);
      } else if (updated.wa_invite_status === 'no_channel') {
        onNotice(`Number saved but no invite went out — ${updated.wa_invite_detail ?? 'no team WhatsApp number is configured.'}`);
      } else if (updated.wa_invite_status === 'failed') {
        onError(`Number saved but the invite failed: ${updated.wa_invite_detail ?? 'unknown error'}`);
      }
      onChanged(updated);
      setWaNumber('');
      setEditing(false);
    } catch (e) {
      const setup = waChannelSetupError(e);
      onError(setup
        ? `${setup.message} Open Settings → WhatsApp to choose a number.`
        : e instanceof Error ? e.message : 'Failed to attach WhatsApp');
    } finally { setBusy(null); }
  }

  async function resend() {
    setBusy('resend'); onError(null); onNotice(null);
    try {
      const res = await resendWhatsAppInvite(member.id);
      onNotice(res.message);
    } catch (e) {
      const setup = waChannelSetupError(e);
      onError(setup
        ? `${setup.message} Open Settings → WhatsApp to choose a number.`
        : e instanceof Error ? e.message : 'Failed to resend');
    } finally { setBusy(null); }
  }

  async function remove() {
    setBusy('remove'); onError(null); onNotice(null);
    try {
      const updated = await detachWhatsApp(member.id);
      onChanged(updated);
      onNotice('WhatsApp channel removed.');
      setConfirmRemove(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to remove WhatsApp');
    } finally { setBusy(null); }
  }

  // NOT CONNECTED — show input to add
  if (member.wa_status === 'not_connected') {
    return (
      <div className="mt-3 rounded-lg bg-bg-secondary/50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
          <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
          <span className="text-xs font-normal text-text-secondary">— not connected</span>
        </div>
        {(
          <>
            <div
              className={
                'flex items-stretch rounded-lg border overflow-hidden focus-within:ring-1 ' +
                (fieldError ? 'border-red-400 focus-within:ring-red-400' : 'border-border-secondary focus-within:ring-accent')
              }
            >
              <span className="flex items-center px-2.5 bg-bg-secondary text-sm font-mono text-text-secondary border-r border-border-secondary select-none">
                +{WA_COUNTRY_CODE}
              </span>
              <input
                value={waNumber}
                onChange={(e) => { setWaNumber(e.target.value.replace(/\D+/g, '').slice(0, WA_LOCAL_LEN)); setFieldError(null); }}
                inputMode="numeric"
                maxLength={WA_LOCAL_LEN}
                placeholder="9876543210"
                className="flex-1 bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary focus:outline-none"
              />
            </div>
            {fieldError ? (
              <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldError}</p>
            ) : (
              <p className="mt-1 text-[11px] text-text-secondary">
                10-digit India mobile number. An Accept/Decline invite goes to this number.
              </p>
            )}
            <button
              onClick={submitNumber}
              disabled={busy === 'attach' || !waNumber.trim() || !setupReady}
              className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy === 'attach' ? 'Sending invite…' : 'Send WhatsApp invite'}
            </button>
          </>
        )}
      </div>
    );
  }

  // CONNECTED — show status + manage actions
  const badge = WA_PILL[member.wa_status];
  const canResend = member.wa_status === 'pending' || member.wa_status === 'declined' || member.wa_status === 'failed';

  return (
    <div className="mt-3 rounded-lg bg-bg-secondary/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
        </div>
        {badge && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
            <badge.Icon className="w-3 h-3" />
            {member.wa_status === 'active' ? 'Verified' : member.wa_status === 'pending' ? 'Pending acceptance' : member.wa_status === 'declined' ? 'Declined' : member.wa_status === 'failed' ? 'Invite failed' : 'Inactive'}
          </span>
        )}
      </div>

      {member.wa_status === 'failed' && member.wa_invite_error_detail && (
        <div className="mb-2 rounded-md bg-red-100/60 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <span className="font-medium">Delivery failed:</span> {member.wa_invite_error_detail}
        </div>
      )}

      {editing ? (
        <>
          <div
            className={
              'flex items-stretch rounded-md border overflow-hidden focus-within:ring-1 ' +
              (fieldError ? 'border-red-400 focus-within:ring-red-400' : 'border-border-secondary focus-within:ring-accent')
            }
          >
            <span className="flex items-center px-2.5 bg-bg-secondary text-sm font-mono text-text-secondary border-r border-border-secondary select-none">
              +{WA_COUNTRY_CODE}
            </span>
            <input
              value={waNumber}
              onChange={(e) => { setWaNumber(e.target.value.replace(/\D+/g, '').slice(0, WA_LOCAL_LEN)); setFieldError(null); }}
              inputMode="numeric"
              maxLength={WA_LOCAL_LEN}
              placeholder={stripCountryCode(member.whatsapp_number) || '9876543210'}
              autoFocus
              className="flex-1 bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary focus:outline-none"
            />
          </div>
          {fieldError ? (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fieldError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-text-secondary">
              Replacing the number resets verification — a fresh invite goes out.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={submitNumber}
              disabled={busy === 'attach' || !waNumber.trim() || !setupReady}
              className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy === 'attach' ? 'Saving…' : 'Save & send invite'}
            </button>
            <button
              onClick={() => { setEditing(false); setWaNumber(''); }}
              className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm text-text-primary">
            <Phone className="w-3.5 h-3.5 text-text-secondary" />
            {member.whatsapp_number && <FormattedWa raw={member.whatsapp_number} />}
          </div>

          {confirmRemove ? (
            <div className="mt-3 rounded-md bg-red-100/60 dark:bg-red-950/30 p-2">
              <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                Remove this WhatsApp channel? Tasks will stop reaching them here.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={remove}
                  disabled={busy === 'remove'}
                  className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === 'remove' ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1">
              {canResend && (
                <button
                  onClick={resend}
                  disabled={busy === 'resend'}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-60"
                >
                  <RefreshCw className="w-3 h-3" />
                  {busy === 'resend' ? 'Sending…' : member.wa_status === 'declined' ? 'Re-invite' : 'Resend invite'}
                </button>
              )}
              <button
                onClick={() => { setEditing(true); setWaNumber(''); }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              >
                <Pencil className="w-3 h-3" /> Change number
              </button>
              <button
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100/60 dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function DeactivateSection({ member, allMembers, onDeactivated }: {
  member: Member;
  allMembers: Member[];
  onDeactivated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = allMembers.filter((m) => m.id !== member.id && m.is_active);

  async function run() {
    setBusy(true); setError(null);
    try {
      await deactivateMember(member.id, {
        reassign_to_member_id: reassignTo ? Number(reassignTo) : null,
        force,
      });
      onDeactivated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="pt-4 mt-1 border-t border-border-secondary/50">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <UserMinus className="w-4 h-4" /> Deactivate member
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-1 border-t border-border-secondary/50">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-2">
        <AlertTriangle className="w-4 h-4" /> Deactivate {member.name}
      </div>
      <p className="text-xs text-text-secondary mb-3">
        Removes access on every channel. Open tasks will be reassigned. History is kept.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      <label className="block text-xs font-medium text-text-secondary mb-1">Reassign open tasks to</label>
      <select
        value={reassignTo}
        onChange={(e) => setReassignTo(e.target.value)}
        className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary"
      >
        <option value="">— nobody —</option>
        {others.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Deactivate even with open tasks (leave them in place)
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-lg border border-border-secondary bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
        >
          Cancel
        </button>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Deactivating...' : 'Deactivate'}
        </button>
      </div>
    </div>
  );
}

type CreateNotice =
  | { kind: 'success'; text: string }
  | { kind: 'warning'; text: string; url?: string }
  | { kind: 'error'; text: string }
  | null;

function CreateMemberModal({ roles, onClose, onCreated, waConfigured }: {
  roles: Role[];
  onClose: () => void;
  onCreated: (notice: CreateNotice) => void;
  waConfigured: boolean;
}) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waFieldError, setWaFieldError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!whatsapp.trim() && !email.trim()) { setError('Add a WhatsApp number, an email, or both.'); return; }

    let normalizedWa: string | null = null;
    if (whatsapp.trim()) {
      const v = validateWaLocal(whatsapp);
      if ('error' in v) { setWaFieldError(v.error); return; }
      normalizedWa = v.digits;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createMember({
        name: name.trim(),
        whatsapp_number: normalizedWa,
        email: email.trim() || null,
        role_id: roleId === '' ? null : roleId,
      });
      onCreated(buildCreateNotice(created));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create member');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border-secondary bg-bg-primary p-6 m-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Add member</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              WhatsApp number <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            {waConfigured ? (
              <>
                <div
                  className={
                    'flex items-stretch rounded-lg border overflow-hidden focus-within:ring-1 ' +
                    (waFieldError ? 'border-red-400 focus-within:ring-red-400' : 'border-border-secondary focus-within:ring-accent')
                  }
                >
                  <span className="flex items-center px-3 bg-bg-secondary text-base font-mono text-text-secondary border-r border-border-secondary select-none">
                    +{WA_COUNTRY_CODE}
                  </span>
                  <input
                    value={whatsapp}
                    onChange={(e) => { setWhatsapp(e.target.value.replace(/\D+/g, '').slice(0, WA_LOCAL_LEN)); setWaFieldError(null); }}
                    inputMode="numeric"
                    maxLength={WA_LOCAL_LEN}
                    placeholder="9876543210"
                    className="flex-1 bg-bg-primary px-3 py-2 text-base text-text-primary font-mono focus:outline-none"
                  />
                </div>
                {waFieldError ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{waFieldError}</p>
                ) : (
                  <p className="mt-1 text-xs text-text-secondary">10-digit India mobile number. Sends a WhatsApp Accept/Decline invite.</p>
                )}
              </>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">Connect a WhatsApp channel in Settings → Channels first.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Portal email <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="name@company.com"
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-text-secondary">Sends an email invite to the dashboard.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Role <span className="text-text-secondary font-normal">(optional)</span>
            </label>
            <select
              value={roleId === '' ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-base text-text-primary"
            >
              <option value="">No role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.is_system ? ' (system)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border-secondary bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {saving ? 'Creating...' : 'Create member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
