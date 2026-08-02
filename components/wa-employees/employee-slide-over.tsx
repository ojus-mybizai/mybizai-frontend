'use client';

import { useEffect, useState } from 'react';
import { X, Phone, Shield, Send, UserX, UserCheck, Trash2, Users, Calendar, CheckCircle } from 'lucide-react';
import { getGroup, type WaEmployee, type WaEmployeeGroup } from '@/services/waEmployees';
import { formatDate } from '@/lib/format-date';

const STATUS_PILL: Record<string, string> = {
  active:             'bg-green-50 text-green-800 border-green-300',
  pending_acceptance: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  rejected:           'bg-red-50 text-red-600 border-red-300',
  inactive:           'bg-gray-100 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
  active:             'Active',
  pending_acceptance: 'Invite Sent',
  rejected:           'Declined',
  inactive:           'Inactive',
};

const STATUS_DOT: Record<string, string> = {
  active:             'bg-green-500',
  pending_acceptance: 'bg-yellow-400',
  rejected:           'bg-red-500',
  inactive:           'bg-gray-400',
};

// Deterministic avatar colour from name
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-800',
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-cyan-100 text-cyan-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];

function avatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

interface Props {
  employee: WaEmployee | null;
  groups: WaEmployeeGroup[];
  onClose: () => void;
  onResendInvite: (emp: WaEmployee) => void;
  onToggleActive: (emp: WaEmployee) => void;
  onRemove: (emp: WaEmployee) => void;
}

export function EmployeeSlideOver({ employee, groups, onClose, onResendInvite, onToggleActive, onRemove }: Props) {
  const [memberGroups, setMemberGroups] = useState<WaEmployeeGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // When employee changes, resolve which groups they belong to
  useEffect(() => {
    if (!employee || groups.length === 0) {
      setMemberGroups([]);
      return;
    }

    setGroupsLoading(true);
    Promise.all(groups.map((g) => getGroup(g.id)))
      .then((details) => {
        const mine = details
          .filter((d) => d.members.some((m) => m.id === employee.id))
          .map((d) => ({ id: d.id, name: d.name, description: d.description, employee_count: d.members.length, created_at: d.created_at }));
        setMemberGroups(mine);
      })
      .catch(() => setMemberGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [employee?.id, groups]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${employee ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-color shadow-2xl z-40
          flex flex-col transition-transform duration-300 ease-in-out
          ${employee ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {employee && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-color shrink-0">
              <h2 className="text-sm font-semibold text-text-primary">Employee Details</h2>
              <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Profile section */}
              <div className="px-5 py-5 border-b border-border-color">
                <div className="flex items-start gap-4">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${avatarColor(employee.name)}`}>
                    {initials(employee.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-text-primary leading-tight">{employee.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-text-secondary text-sm">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono">+{employee.whatsapp_number}</span>
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_PILL[employee.status] || 'bg-bg-secondary text-text-secondary border-border-color'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[employee.status] || 'bg-gray-400'}`} />
                        {STATUS_LABELS[employee.status] || employee.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meta info */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Added {formatDate(employee.created_at)}</span>
                  </div>
                  {employee.verified_at ? (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Accepted {formatDate(employee.verified_at)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0 opacity-30" />
                      <span>Not yet accepted</span>
                    </div>
                  )}
                  {employee.contact_id && (
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      <span>Linked to contact — AI routing active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Groups section */}
              <div className="px-5 py-4 border-b border-border-color">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-3.5 h-3.5 text-text-secondary" />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Groups</span>
                </div>
                {groupsLoading ? (
                  <div className="flex gap-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-6 w-20 bg-bg-secondary rounded-full animate-pulse" />
                    ))}
                  </div>
                ) : memberGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {memberGroups.map((g) => (
                      <span key={g.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-secondary text-text-primary text-xs rounded-full border border-border-color">
                        <Users className="w-3 h-3 text-text-secondary" /> {g.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">Not in any group</p>
                )}
              </div>

              {/* Actions section */}
              <div className="px-5 py-4">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</span>
                <div className="mt-3 space-y-1">
                  {(employee.status === 'pending_acceptance' || employee.status === 'rejected') && (
                    <button
                      onClick={() => onResendInvite(employee)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-text-primary hover:bg-bg-secondary transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <Send className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">Resend Invite</div>
                        <div className="text-xs text-text-secondary">Send Accept/Decline button again</div>
                      </div>
                    </button>
                  )}

                  {employee.is_active ? (
                    <button
                      onClick={() => onToggleActive(employee)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-text-primary hover:bg-bg-secondary transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                        <UserX className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-medium">Deactivate</div>
                        <div className="text-xs text-text-secondary">Stop work assignments & attendance</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => onToggleActive(employee)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-text-primary hover:bg-bg-secondary transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">Reactivate</div>
                        <div className="text-xs text-text-secondary">Resend WhatsApp invite to accept</div>
                      </div>
                    </button>
                  )}

                  <div className="my-2 border-t border-border-color" />

                  <button
                    onClick={() => onRemove(employee)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium">Remove Employee</div>
                      <div className="text-xs text-red-400">Permanently removes from this business</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
