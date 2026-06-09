'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserPlus, ChevronUp, ChevronDown, ChevronsUpDown, MoreVertical, Send, UserX, UserCheck, Trash2, Shield, Search, X, MessageCircle, Lock } from 'lucide-react';
import type { WaEmployee, WaEmployeeGroup } from '@/services/waEmployees';

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

const STATUS_PILL: Record<string, string> = {
  active:             'bg-green-50 text-green-700 border-green-200',
  pending_acceptance: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  rejected:           'bg-red-50 text-red-600 border-red-200',
  inactive:           'bg-gray-100 text-gray-500 border-gray-200',
};

type SortField = 'name' | 'status' | 'verified_at' | 'session';
type SortDir   = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'pending_acceptance' | 'rejected' | 'inactive';

/**
 * Format the time remaining in the WhatsApp 24h free-form messaging window.
 * Returns e.g. "23h 14m", "47m", "<1m", or null if the window is closed.
 */
function formatSessionRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  employees: WaEmployee[];
  groups: WaEmployeeGroup[];
  onRowClick: (emp: WaEmployee) => void;
  onResendInvite: (emp: WaEmployee) => void;
  onToggleActive: (emp: WaEmployee) => void;
  onRemove: (emp: WaEmployee) => void;
  onAddEmployee: () => void;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="w-3.5 h-3.5 text-text-secondary/40 ml-1 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3.5 h-3.5 text-accent ml-1 inline" />
    : <ChevronDown className="w-3.5 h-3.5 text-accent ml-1 inline" />;
}

export function EmployeeTable({ employees, groups, onRowClick, onResendInvite, onToggleActive, onRemove, onAddEmployee }: Props) {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField,    setSortField]    = useState<SortField>('name');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [openMenuId,   setOpenMenuId]   = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId !== null) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [openMenuId]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const STATUS_ORDER: Record<string, number> = { active: 0, pending_acceptance: 1, rejected: 2, inactive: 3 };

  const filtered = employees
    .filter((e) => statusFilter === 'all' || e.status === statusFilter)
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.whatsapp_number.includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name')        cmp = a.name.localeCompare(b.name);
      else if (sortField === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      else if (sortField === 'verified_at') {
        const av = a.verified_at ? new Date(a.verified_at).getTime() : 0;
        const bv = b.verified_at ? new Date(b.verified_at).getTime() : 0;
        cmp = av - bv;
      }
      else if (sortField === 'session') {
        // Open sessions first (sorted by remaining time desc), then closed
        const av = a.session_active && a.session_window_expires_at ? new Date(a.session_window_expires_at).getTime() : 0;
        const bv = b.session_active && b.session_window_expires_at ? new Date(b.session_window_expires_at).getTime() : 0;
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const counts = {
    all:                employees.length,
    active:             employees.filter((e) => e.status === 'active').length,
    pending_acceptance: employees.filter((e) => e.status === 'pending_acceptance').length,
    rejected:           employees.filter((e) => e.status === 'rejected').length,
    inactive:           employees.filter((e) => e.status === 'inactive').length,
  };

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',                label: 'All' },
    { key: 'active',             label: 'Active' },
    { key: 'pending_acceptance', label: 'Invite Sent' },
    { key: 'rejected',           label: 'Declined' },
    { key: 'inactive',           label: 'Inactive' },
  ];

  return (
    <div className="space-y-3">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search by name or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
                ${statusFilter === key
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-primary text-text-secondary border-border-color hover:border-accent/40 hover:text-text-primary'
                }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                  ${statusFilter === key ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-secondary'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-primary border border-border-color rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-bg-secondary flex items-center justify-center opacity-60">
              <UserPlus className="w-5 h-5" />
            </div>
            <p className="font-medium text-text-primary">
              {search || statusFilter !== 'all' ? 'No employees match your filters' : 'No employees added yet'}
            </p>
            <p className="text-sm mt-1">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter'
                : "Add employees — they'll get a WhatsApp invite to accept or decline"}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={onAddEmployee}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                <UserPlus className="w-4 h-4" /> Add First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary border-b border-border-color">
                <tr>
                  <th
                    className="text-left px-4 py-3 text-text-secondary font-medium cursor-pointer select-none hover:text-text-primary"
                    onClick={() => toggleSort('name')}
                  >
                    Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 text-text-secondary font-medium hidden sm:table-cell">
                    WhatsApp
                  </th>
                  <th
                    className="text-left px-4 py-3 text-text-secondary font-medium cursor-pointer select-none hover:text-text-primary"
                    onClick={() => toggleSort('status')}
                  >
                    Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-text-secondary font-medium cursor-pointer select-none hover:text-text-primary"
                    onClick={() => toggleSort('session')}
                    title="WhatsApp 24-hour customer service window. While open, the business can send any free-form message; once closed, only approved templates work."
                  >
                    Session <SortIcon field="session" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className="text-left px-4 py-3 text-text-secondary font-medium hidden md:table-cell cursor-pointer select-none hover:text-text-primary"
                    onClick={() => toggleSort('verified_at')}
                  >
                    Verified <SortIcon field="verified_at" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => onRowClick(emp)}
                    className="hover:bg-bg-secondary cursor-pointer transition-colors group"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-accent">
                            {emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-text-primary leading-tight">{emp.name}</div>
                          {emp.contact_id ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 mt-0.5">
                              <Shield className="w-3 h-3" /> Linked
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* WhatsApp */}
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs hidden sm:table-cell">
                      +{emp.whatsapp_number}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_PILL[emp.status] || 'bg-bg-secondary text-text-secondary border-border-color'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[emp.status] || 'bg-gray-400'}`} />
                        {STATUS_LABELS[emp.status] || emp.status}
                      </span>
                    </td>

                    {/* WhatsApp 24h service window */}
                    <td className="px-4 py-3">
                      {(() => {
                        const remaining = formatSessionRemaining(emp.session_window_expires_at);
                        if (emp.session_active && remaining) {
                          return (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200"
                              title={`Free-form messages allowed for ${remaining} (until ${new Date(emp.session_window_expires_at!).toLocaleString()})`}
                            >
                              <MessageCircle className="w-3 h-3" />
                              Open · {remaining}
                            </span>
                          );
                        }
                        return (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200"
                            title={
                              emp.session_window_expires_at
                                ? `Window closed at ${new Date(emp.session_window_expires_at).toLocaleString()}. Only approved templates can be sent.`
                                : 'Employee has never sent an inbound message. Only approved templates can be sent.'
                            }
                          >
                            <Lock className="w-3 h-3" />
                            Closed
                          </span>
                        );
                      })()}
                    </td>

                    {/* Verified date */}
                    <td className="px-4 py-3 text-text-secondary text-xs hidden md:table-cell">
                      {emp.verified_at ? new Date(emp.verified_at).toLocaleDateString() : '—'}
                    </td>

                    {/* Context menu */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative" ref={openMenuId === emp.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === emp.id ? null : emp.id)}
                          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary opacity-0 group-hover:opacity-100 transition-all"
                          title="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === emp.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-bg-primary border border-border-color rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                            {(emp.status === 'pending_acceptance' || emp.status === 'rejected') && (
                              <button
                                onClick={() => { setOpenMenuId(null); onResendInvite(emp); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary text-left"
                              >
                                <Send className="w-3.5 h-3.5 text-green-600" /> Resend Invite
                              </button>
                            )}
                            {emp.is_active ? (
                              <button
                                onClick={() => { setOpenMenuId(null); onToggleActive(emp); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary text-left"
                              >
                                <UserX className="w-3.5 h-3.5 text-orange-500" /> Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => { setOpenMenuId(null); onToggleActive(emp); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary text-left"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-green-600" /> Reactivate
                              </button>
                            )}
                            <div className="my-1 border-t border-border-color" />
                            <button
                              onClick={() => { setOpenMenuId(null); onRemove(emp); }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-text-secondary px-1">
          Showing {filtered.length} of {employees.length} employee{employees.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
