'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Phone, Shield, X, Search, MessageCircle, KeyRound, Send, CalendarCheck, CircleDot, UserMinus, AlertTriangle, Download, Mail } from 'lucide-react';
import {
  listMembers, createMember, attachWhatsApp, attachPortal,
  getMemberAttendance, sendMemberCheckin, deactivateMember,
  type Member, type MemberAttendanceDay, type MemberDeactivateResult,
} from '@/services/members';
import { getEmployeeChat, sendEmployeeChatMessage, downloadAttendanceExport, type WaEmployeeChatMessage } from '@/services/waEmployees';
import {
  getAssignableRoles, listEmployeeInvites, resendEmployeeInvite, revokeEmployeeInvite,
  type AssignableRole, type EmployeeInvite,
} from '@/services/employees';
import { formatDateTime } from '@/lib/format-date';

const CHANNEL_PILL: Record<string, string> = {
  portal:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
  whatsapp: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300',
};

const STATUS_PILL: Record<string, string> = {
  active:             'bg-green-50 text-green-800 border-green-300',
  pending_acceptance: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  rejected:           'bg-red-50 text-red-600 border-red-300',
  inactive:           'bg-gray-100 text-gray-500 border-gray-200',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [view, setView] = useState<'members' | 'invitations'>('members');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listMembers(q ? { q } : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Members</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            One place for everyone — reachable on the portal, WhatsApp, or both.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CheckinButton />
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add member
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-border-color">
        {(['members', 'invitations'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {v === 'members' ? 'Members' : 'Invitations'}
          </button>
        ))}
      </div>

      {view === 'invitations' ? (
        <InvitationsPanel />
      ) : (
      <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
            placeholder="Search name or number…"
            className="w-full rounded-lg border border-border-color bg-bg-primary pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:border-accent">
          Search
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border-color overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-secondary">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Channels</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">Loading…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">No members yet — add your first one.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} onClick={() => setSelected(m)} className="border-t border-border-color hover:bg-bg-secondary/50 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{m.name}</span>
                      {m.checked_in_today != null && (
                        <span
                          title={m.checked_in_today ? 'Checked in today' : 'Not checked in today'}
                          className={`inline-flex items-center gap-1 text-[10px] font-medium ${m.checked_in_today ? 'text-green-600' : 'text-text-secondary'}`}
                        >
                          <CircleDot className="w-3 h-3" />{m.checked_in_today ? 'In' : 'Out'}
                        </span>
                      )}
                    </div>
                    {m.whatsapp_number && (
                      <div className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                        <Phone className="w-3 h-3" /> <span className="font-mono">+{m.whatsapp_number}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {m.channels.length === 0 && <span className="text-xs text-text-secondary">—</span>}
                      {m.channels.map((c) => (
                        <span key={c} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CHANNEL_PILL[c] || ''}`}>
                          {c === 'portal' ? 'Portal' : 'WhatsApp'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {m.role_name ? (
                      <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3" />{m.role_name}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_PILL[m.status] || 'bg-bg-secondary text-text-secondary border-border-color'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {showCreate && (
        <CreateMemberModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}

      {selected && (
        <MemberDetail
          member={selected}
          allMembers={members}
          onClose={() => setSelected(null)}
          onChanged={(m) => { setSelected(m); void load(); }}
          onDeactivated={() => { setSelected(null); void load(); }}
        />
      )}
    </div>
  );
}

const INVITE_STATUS_PILL: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  revoked:  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  expired:  'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

// Invite lifecycle — folded in from the retired /employees screen (Slice 5b).
// Members are invited via "Add member" (the member-linked email path); this
// panel surfaces the pending-invite lifecycle: resend + revoke.
function InvitationsPanel() {
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setInvites(await listEmployeeInvites()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load invites'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function resend(id: number) {
    setActionId(id); setError(null); setNotice(null);
    try {
      const updated = await resendEmployeeInvite(id);
      setInvites((p) => p.map((i) => (i.id === id ? updated : i)));
      setNotice(`Invite resent to ${updated.email}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to resend invite'); }
    finally { setActionId(null); }
  }

  async function revoke(id: number) {
    const invite = invites.find((i) => i.id === id);
    if (!invite) return;
    if (typeof window !== 'undefined' &&
        !window.confirm(`Revoke this invite for ${invite.email}? The link will stop working.`)) return;
    setActionId(id); setError(null); setNotice(null);
    try {
      const updated = await revokeEmployeeInvite(id);
      setInvites((p) => p.map((i) => (i.id === id ? updated : i)));
      setNotice(`Invite revoked for ${updated.email}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to revoke invite'); }
    finally { setActionId(null); }
  }

  return (
    <div>
      <p className="mb-4 flex items-center gap-1.5 text-xs text-text-secondary">
        <Mail className="w-3.5 h-3.5" /> Invite people from <span className="font-medium text-text-primary">Add member</span> (portal email).
        Pending invites and their lifecycle live here.
      </p>

      {notice && <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

      <div className="rounded-xl border border-border-color overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-secondary">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Invitee</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Expires</th>
              <th className="text-right font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">Loading…</td></tr>
            ) : invites.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No invites yet — add a member with a portal email to send one.</td></tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id} className="border-t border-border-color">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{inv.name || '—'}</div>
                    <div className="text-xs text-text-secondary">{inv.email}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{inv.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INVITE_STATUS_PILL[inv.status] || 'bg-bg-secondary text-text-secondary'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(inv.expires_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => void resend(inv.id)} disabled={actionId === inv.id}
                          className="rounded-lg border border-border-color bg-bg-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:border-accent disabled:opacity-60">
                          Resend
                        </button>
                        <button onClick={() => void revoke(inv.id)} disabled={actionId === inv.id}
                          className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-60">
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberDetail({ member, allMembers, onClose, onChanged, onDeactivated }: {
  member: Member;
  allMembers: Member[];
  onClose: () => void;
  onChanged: (m: Member) => void;
  onDeactivated: () => void;
}) {
  const [waNumber, setWaNumber] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'wa' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasWa = member.channels.includes('whatsapp');
  const hasPortal = member.channels.includes('portal');

  async function addWa() {
    if (!waNumber.trim()) return;
    setBusy('wa'); setError(null);
    try { onChanged(await attachWhatsApp(member.id, waNumber.trim())); setWaNumber(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to add WhatsApp'); }
    finally { setBusy(null); }
  }
  async function addPortal() {
    if (!email.trim()) return;
    setBusy('portal'); setError(null);
    try { onChanged(await attachPortal(member.id, email.trim())); setEmail(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to add login'); }
    finally { setBusy(null); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-color shadow-2xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <h2 className="text-sm font-semibold text-text-primary">Member</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{member.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {hasPortal && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300">Portal</span>}
              {hasWa && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300">WhatsApp</span>}
              {member.channels.length === 0 && <span className="text-xs text-text-secondary">No channels yet</span>}
            </div>
            {member.whatsapp_number && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary"><Phone className="w-3.5 h-3.5" /><span className="font-mono">+{member.whatsapp_number}</span></div>
            )}
            {member.role_name && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary"><Shield className="w-3.5 h-3.5" />{member.role_name}</div>
            )}
          </div>

          {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Channels</span>

            {!hasWa && (
              <div className="mt-3 rounded-lg border border-border-color p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"><MessageCircle className="w-4 h-4 text-green-600" /> Add WhatsApp</div>
                <input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="919876543210"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
                <button onClick={() => void addWa()} disabled={busy === 'wa'} className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy === 'wa' ? 'Sending invite…' : 'Send WhatsApp invite'}
                </button>
              </div>
            )}

            {!hasPortal && (
              <div className="mt-3 rounded-lg border border-border-color p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"><KeyRound className="w-4 h-4 text-blue-600" /> Add dashboard login</div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
                <button onClick={() => void addPortal()} disabled={busy === 'portal'} className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy === 'portal' ? 'Sending invite…' : 'Send email invite'}
                </button>
              </div>
            )}

            {hasWa && hasPortal && <p className="mt-3 text-xs text-text-secondary">This member is reachable on both channels.</p>}
          </div>

          {hasWa && <AttendanceSection memberId={member.id} waId={member.legacy_wa_employee_id} memberName={member.name} />}

          {member.legacy_wa_employee_id != null && <ChatSection waId={member.legacy_wa_employee_id} />}

          <DeactivateSection member={member} allMembers={allMembers} onDeactivated={onDeactivated} />
        </div>
      </div>
    </>
  );
}

function AttendanceSection({ memberId, waId, memberName }: { memberId: number; waId: number | null; memberName: string }) {
  const [days, setDays] = useState<MemberAttendanceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getMemberAttendance(memberId, 14)
      .then((d) => { if (live) setDays(d); })
      .catch(() => { if (live) setDays([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [memberId]);

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  async function exportCsv() {
    if (waId == null) return;
    setExporting(true);
    try {
      const blob = await downloadAttendanceExport({ employee_id: waId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${memberName.replace(/\s+/g, '-').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* export failed — silent; button re-enables */ }
    finally { setExporting(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <CalendarCheck className="w-3.5 h-3.5" /> Attendance <span className="normal-case font-normal">(14 days)</span>
        </span>
        {waId != null && (
          <button
            onClick={() => void exportCsv()}
            disabled={exporting}
            title="Download this member's attendance as CSV"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>
      <div className="mt-3 rounded-lg border border-border-color overflow-hidden">
        {loading ? (
          <p className="text-xs text-text-secondary text-center py-4">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-4">No attendance recorded yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-bg-secondary text-text-secondary">
              <tr>
                <th className="text-left font-medium px-3 py-1.5">Date</th>
                <th className="text-left font-medium px-3 py-1.5">In</th>
                <th className="text-left font-medium px-3 py-1.5">Out</th>
                <th className="text-right font-medium px-3 py-1.5">Hrs</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-border-color">
                  <td className="px-3 py-1.5 text-text-primary">{d.date}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{fmtTime(d.check_in_at)}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{fmtTime(d.check_out_at)}</td>
                  <td className="px-3 py-1.5 text-right text-text-secondary">{d.work_hours != null ? d.work_hours.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
  const [conflict, setConflict] = useState<Record<string, number> | null>(null);

  const others = allMembers.filter((m) => m.id !== member.id && m.is_active);

  async function run() {
    setBusy(true); setError(null);
    try {
      const res: MemberDeactivateResult = await deactivateMember(member.id, {
        reassign_to_member_id: reassignTo ? Number(reassignTo) : null,
        force,
      });
      void res;
      onDeactivated();
    } catch (e) {
      // 409 → surface open-assignment counts and let the owner reassign or force.
      const err = e as { status?: number; data?: { detail?: unknown }; message?: string };
      const detail = err?.data?.detail;
      if (err?.status === 409 && detail && typeof detail === 'object') {
        setConflict(detail as Record<string, number> & { message: string });
        setError((detail as { message?: string }).message ?? 'Member has active assignments.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to deactivate');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="pt-2 border-t border-border-color">
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
    <div className="pt-3 border-t border-border-color">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-2">
        <AlertTriangle className="w-4 h-4" /> Deactivate {member.name}
      </div>
      <p className="text-xs text-text-secondary mb-3">
        Removes access on every channel and resets AI routing. History is kept.
      </p>

      {conflict && (
        <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          Open assignments: {conflict.work || 0} work · {conflict.contacts || 0} contacts ·{' '}
          {conflict.wa_contacts || 0} WA contacts · {conflict.wa_tasks || 0} WA tasks. Reassign or force below.
        </div>
      )}
      {error && !conflict && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      <label className="block text-xs font-medium text-text-secondary mb-1">Reassign open items to</label>
      <select
        value={reassignTo}
        onChange={(e) => setReassignTo(e.target.value)}
        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">— nobody —</option>
        {others.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Deactivate even with open assignments (leave them in place)
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => { setOpen(false); setConflict(null); setError(null); }}
          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
        >
          Cancel
        </button>
        <button
          onClick={() => void run()}
          disabled={busy}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? 'Deactivating…' : 'Deactivate'}
        </button>
      </div>
    </div>
  );
}

function ChatSection({ waId }: { waId: number }) {
  const [messages, setMessages] = useState<WaEmployeeChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setMessages((await getEmployeeChat(waId)).messages); }
    catch { setMessages([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [waId]);

  async function send() {
    if (!text.trim()) return;
    setSending(true); setError(null);
    try { const m = await sendEmployeeChatMessage(waId, text.trim()); setMessages((p) => [...p, m]); setText(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to send'); }
    finally { setSending(false); }
  }

  return (
    <div>
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">WhatsApp chat</span>
      <div className="mt-3 rounded-lg border border-border-color bg-bg-secondary/40 p-2 h-48 overflow-y-auto space-y-1.5">
        {loading ? (
          <p className="text-xs text-text-secondary text-center py-4">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-4">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${m.role === 'user' ? 'ml-auto bg-accent text-white' : 'bg-bg-primary border border-border-color text-text-primary'}`}>
              {m.content}
            </div>
          ))
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          placeholder="Message…" className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
        <button onClick={() => void send()} disabled={sending} className="rounded-lg bg-accent px-3 py-2 text-white hover:opacity-90 disabled:opacity-60">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CreateMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // RBAC assignable roles (from /employees/roles) — NOT the agent-role axis.
  useEffect(() => {
    getAssignableRoles().then(setRoles).catch(() => setRoles([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!whatsapp.trim() && !email.trim()) { setError('Add a WhatsApp number, an email, or both.'); return; }
    setSaving(true);
    setError(null);
    try {
      await createMember({
        name: name.trim(),
        whatsapp_number: whatsapp.trim() || null,
        email: email.trim() || null,
        role_id: roleId === '' ? null : roleId,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create member');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Add member</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">WhatsApp number <span className="text-text-secondary font-normal">(optional)</span></label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="919876543210"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent" />
            <p className="mt-1 text-xs text-text-secondary">Sends a WhatsApp Accept/Decline invite.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Portal email <span className="text-text-secondary font-normal">(optional)</span></label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
            <p className="mt-1 text-xs text-text-secondary">Sends an email invite to the dashboard.</p>
          </div>
          {roles.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Role <span className="text-text-secondary font-normal">(optional)</span></label>
              <select
                value={roleId === '' ? '' : String(roleId)}
                onChange={(e) => setRoleId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-secondary">Sets dashboard access. Manage roles in Settings → Roles &amp; Permissions.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {saving ? 'Creating…' : 'Create member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CheckinButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await sendMemberCheckin();
      setMsg(r.sent === 0 && r.failed === 0 ? 'No one to check in' : `Sent to ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-text-secondary">{msg}</span>}
      <button
        onClick={() => void run()}
        disabled={busy}
        title="Send today's attendance check-in to all WhatsApp members"
        className="inline-flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-60"
      >
        <CalendarCheck className="w-4 h-4" /> {busy ? 'Sending…' : 'Send check-in'}
      </button>
    </div>
  );
}
