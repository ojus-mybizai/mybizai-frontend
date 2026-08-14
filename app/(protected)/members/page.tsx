'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Phone, Shield, X, Search, MessageCircle,
  KeyRound, UserMinus, AlertTriangle, Mail,
} from 'lucide-react';
import {
  listMembers, createMember, updateMember, attachWhatsApp, attachPortal,
  deactivateMember, resendWhatsAppInvite, resendPortalInvite, waChannelSetupError,
  type Member, type MemberCreatePayload,
} from '@/services/members';
import { listRoles, type Role } from '@/services/roles';
import { getWaSettings } from '@/services/waEmployees';

/**
 * Whether the business can actually send to members over WhatsApp.
 *  - 'no_channels'  → nothing connected yet (Settings → Channels)
 *  - 'not_selected' → numbers connected, but none designated for the team
 *                     (Settings → WhatsApp). The backend refuses to guess.
 */
type WaSetup = 'loading' | 'ready' | 'no_channels' | 'not_selected';

const CHANNEL_PILL: Record<string, string> = {
  portal:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
  whatsapp: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300',
};

const STATUS_PILL: Record<string, string> = {
  active:             'bg-green-50 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300',
  pending_acceptance: 'bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300',
  rejected:           'bg-red-50 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-300',
  inactive:           'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [waSetup, setWaSetup] = useState<WaSetup>('loading');
  const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);

  useEffect(() => {
    getWaSettings()
      .then(s => {
        const connected = s.available_channels || [];
        if (connected.length === 0) setWaSetup('no_channels');
        // A saved id that isn't in the connected list is a deleted/disconnected
        // channel — same as never choosing one. The backend refuses both.
        else if (!connected.some(c => c.id === s.wa_employee_channel_id)) setWaSetup('not_selected');
        else setWaSetup('ready');
      })
      .catch(() => setWaSetup('no_channels'));
  }, []);

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

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
          {notice.text}
          {notice.url && (
            <>
              {' '}
              <a href={notice.url} className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                Open WhatsApp settings
              </a>
            </>
          )}
        </div>
      )}

      {(waSetup === 'no_channels' || waSetup === 'not_selected') && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-900/20 dark:border-amber-700">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {waSetup === 'no_channels'
                ? 'No WhatsApp number connected'
                : 'No WhatsApp number chosen for your team'}
            </p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
              {waSetup === 'no_channels' ? (
                <>
                  Connect a WhatsApp Business number in{' '}
                  <a href="/settings/channels" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                    Settings → Channels
                  </a>{' '}
                  before adding members via WhatsApp.
                </>
              ) : (
                <>
                  Invites and tasks won&apos;t send until you pick which of your connected numbers
                  reaches your team in{' '}
                  <a href="/settings/whatsapp" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                    Settings → WhatsApp
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border-secondary overflow-hidden">
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
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">Loading...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-text-secondary">No members yet — add your first one.</td></tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} onClick={() => setSelected(m)} className="border-t border-border-secondary hover:bg-bg-secondary/50 cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary">{m.name}</span>
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_PILL[m.status] || 'bg-bg-secondary text-text-secondary border-border-secondary'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
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
  const [waNumber, setWaNumber] = useState('');
  const [email, setEmail] = useState('');
  const [editRole, setEditRole] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>(member.role_id ?? '');
  const [busy, setBusy] = useState<'wa' | 'portal' | 'role' | 'resend_wa' | 'resend_portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
            <div className="mt-1 flex flex-wrap gap-1.5">
              {hasPortal && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300">Portal</span>}
              {hasWa && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300">WhatsApp</span>}
              {member.channels.length === 0 && <span className="text-xs text-text-secondary">No channels yet</span>}
            </div>
            {member.whatsapp_number && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
                <Phone className="w-3.5 h-3.5" /><span className="font-mono">+{member.whatsapp_number}</span>
              </div>
            )}

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
                <button onClick={() => setEditRole(true)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
                  <Shield className="w-3.5 h-3.5" />
                  {member.role_name || 'No role'} <span className="text-xs text-accent ml-1">edit</span>
                </button>
              )}
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>}
          {notice && <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">{notice}</div>}

          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Channels</span>

            {!hasWa && (
              <div className="mt-3 rounded-lg border border-border-secondary p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <MessageCircle className="w-4 h-4 text-green-600" /> Add WhatsApp
                </div>
                {waSetup === 'no_channels' ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Connect a WhatsApp channel in{' '}
                    <a href="/settings/channels" className="underline font-medium">Settings → Channels</a> first.
                  </p>
                ) : waSetup === 'not_selected' ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Pick the number that reaches your team in{' '}
                    <a href="/settings/whatsapp" className="underline font-medium">Settings → WhatsApp</a> first.
                  </p>
                ) : (
                  <>
                    <input
                      value={waNumber}
                      onChange={(e) => setWaNumber(e.target.value)}
                      placeholder="919876543210"
                      className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button onClick={addWa} disabled={busy === 'wa'} className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                      {busy === 'wa' ? 'Sending invite...' : 'Send WhatsApp invite'}
                    </button>
                  </>
                )}
              </div>
            )}

            {!hasPortal && (
              <div className="mt-3 rounded-lg border border-border-secondary p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <KeyRound className="w-4 h-4 text-blue-600" /> Add dashboard login
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button onClick={addPortal} disabled={busy === 'portal'} className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                  {busy === 'portal' ? 'Sending invite...' : 'Send email invite'}
                </button>
              </div>
            )}

            {/* Resend invite buttons for attached channels */}
            {hasWa && (member.status === 'pending_acceptance' || member.status === 'rejected') && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    <span className={`font-medium ${member.status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'}`}>
                      {member.status === 'rejected' ? 'Declined' : 'Pending acceptance'}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      setBusy('resend_wa'); setError(null); setNotice(null);
                      try {
                        const res = await resendWhatsAppInvite(member.id);
                        setNotice(res.message);
                      } catch (e) {
                        const setup = waChannelSetupError(e);
                        setError(setup
                          ? `${setup.message} Open Settings → WhatsApp to choose a number.`
                          : e instanceof Error ? e.message : 'Failed to resend');
                      }
                      finally { setBusy(null); }
                    }}
                    disabled={busy === 'resend_wa'}
                    className="text-xs font-semibold text-accent hover:underline disabled:opacity-60"
                  >
                    {busy === 'resend_wa' ? 'Sending...' : member.status === 'rejected' ? 'Re-invite' : 'Resend invite'}
                  </button>
                </div>
              </div>
            )}

            {hasPortal && !member.has_login && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-amber-700 dark:text-amber-300">Portal invite pending</span>
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
                    className="text-xs font-semibold text-accent hover:underline disabled:opacity-60"
                  >
                    {busy === 'resend_portal' ? 'Sending...' : 'Resend email invite'}
                  </button>
                </div>
              </div>
            )}

            {hasWa && hasPortal && member.status === 'active' && member.has_login && (
              <p className="mt-3 text-xs text-text-secondary">This member is reachable on both channels.</p>
            )}
          </div>

          <DeactivateSection member={member} allMembers={allMembers} onDeactivated={onDeactivated} />
        </div>
      </div>
    </>
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
      <div className="pt-2 border-t border-border-secondary">
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
    <div className="pt-3 border-t border-border-secondary">
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

type CreateWarning = { text: string; url?: string } | null;

function CreateMemberModal({ roles, onClose, onCreated, waConfigured }: {
  roles: Role[];
  onClose: () => void;
  onCreated: (warning: CreateWarning) => void;
  waConfigured: boolean;
}) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!whatsapp.trim() && !email.trim()) { setError('Add a WhatsApp number, an email, or both.'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await createMember({
        name: name.trim(),
        whatsapp_number: whatsapp.trim() || null,
        email: email.trim() || null,
        role_id: roleId === '' ? null : roleId,
      });
      // The member is created even when the WhatsApp invite doesn't go out —
      // hand the real outcome to the page instead of implying it was sent.
      let warning: { text: string; url?: string } | null = null;
      if (created.wa_invite_status === 'no_channel') {
        warning = {
          text: `${created.name} was added, but the WhatsApp invite was not sent. ${created.wa_invite_detail ?? ''}`.trim(),
          url: created.wa_invite_settings_url ?? '/settings/whatsapp',
        };
      } else if (created.wa_invite_status === 'failed') {
        warning = {
          text: `${created.name} was added, but WhatsApp rejected the invite: ${created.wa_invite_detail ?? 'unknown error'}. Use "Resend invite" to try again.`,
        };
      }
      onCreated(warning);
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
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="919876543210"
                  className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-base text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-1 text-xs text-text-secondary">Sends a WhatsApp Accept/Decline invite.</p>
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
