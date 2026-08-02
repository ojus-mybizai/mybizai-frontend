'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users, UserPlus, CheckCircle, Clock, XCircle, RefreshCw,
  UserX, UserCheck, Trash2, Phone, Shield, Plus, X, Settings, Save, Send,
  AlertTriangle, Wifi,
} from 'lucide-react';
import { formatDate } from '@/lib/format-date';
import {
  listEmployees, addEmployee, resendInvite,
  updateEmployee, deleteEmployee, listGroups, createGroup, updateGroup,
  deleteGroup, addGroupMembers, removeGroupMember, getGroup,
  getAttendance, setManualAttendance, sendDailyCheckin,
  getWaSettings, updateWaSettings,
  type WaEmployee, type WaEmployeeGroup, type WaEmployeeGroupDetail,
  type AttendanceRecord, type WaSettings,
} from '@/services/waEmployees';
import { ToastContainer, type Toast, type ToastType } from '@/components/ui/toast';
import { ConfirmDialog, type ConfirmDialogConfig } from '@/components/ui/confirm-dialog';
import { EmployeeTable } from '@/components/wa-employees/employee-table';
import { EmployeeSlideOver } from '@/components/wa-employees/employee-slide-over';
import { BulkAddModal } from '@/components/wa-employees/bulk-add-modal';
import { GroupDetailPanel } from '@/components/wa-employees/group-detail-panel';
import { AttendanceCalendar } from '@/components/wa-employees/attendance-calendar';
import { AttendanceDayTable } from '@/components/wa-employees/attendance-day-table';


type Tab = 'employees' | 'groups' | 'attendance' | 'settings';

export default function WaEmployeesPage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<WaEmployee[]>([]);
  const [groups, setGroups] = useState<WaEmployeeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add employee modal
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCountryCode, setAddCountryCode] = useState('91');
  const [addLocalNumber, setAddLocalNumber] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Bulk add modal
  const [showBulk, setShowBulk] = useState(false);

  // Group panel
  const [showCreateGroup,  setShowCreateGroup]  = useState(false);
  const [groupName,        setGroupName]         = useState('');
  const [groupDesc,        setGroupDesc]         = useState('');
  const [groupEmployeeIds, setGroupEmployeeIds]  = useState<number[]>([]);
  const [selectedGroup,    setSelectedGroup]     = useState<WaEmployeeGroupDetail | null>(null);
  const [groupDetails,     setGroupDetails]      = useState<Map<number, WaEmployeeGroupDetail>>(new Map());

  // Attendance — calendar + day-detail
  const [calendarMonth,       setCalendarMonth]       = useState<Date>(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [monthRecords,        setMonthRecords]        = useState<Map<string, AttendanceRecord[]>>(new Map());
  const [monthLoading,        setMonthLoading]        = useState(false);
  const [checkinSending,      setCheckinSending]      = useState(false);
  const [exportDateFrom,      setExportDateFrom]      = useState(() => new Date().toISOString().split('T')[0]);
  const [exportDateTo,        setExportDateTo]        = useState(() => new Date().toISOString().split('T')[0]);

  // Slide-over
  const [selectedEmployee, setSelectedEmployee] = useState<WaEmployee | null>(null);

  // Settings
  const [settings, setSettings] = useState<WaSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsChannelId, setSettingsChannelId] = useState<string>('');
  const [settingsTaskTemplate, setSettingsTaskTemplate] = useState('');
  const [settingsCheckinTime, setSettingsCheckinTime] = useState('');
  const [settingsCheckinEnabled, setSettingsCheckinEnabled] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Confirm dialog
  const [confirmConfig, setConfirmConfig] = useState<ConfirmDialogConfig | null>(null);
  const openConfirm = useCallback((config: Omit<ConfirmDialogConfig, 'onCancel'>) => {
    setConfirmConfig({ ...config, onCancel: () => setConfirmConfig(null) });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, grps, s] = await Promise.all([listEmployees(), listGroups(), getWaSettings()]);
      setEmployees(emps);
      setGroups(grps);
      setSettings(s);
      setSettingsChannelId(s.wa_employee_channel_id ? String(s.wa_employee_channel_id) : '');
      setSettingsTaskTemplate(s.task_template_name || '');
      setSettingsCheckinTime(s.checkin_schedule_time || '');
      setSettingsCheckinEnabled(s.checkin_schedule_enabled);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonthAttendance = useCallback(async (month: Date) => {
    const year     = month.getFullYear();
    const mon      = month.getMonth();
    const dateFrom = `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    const lastDay  = new Date(year, mon + 1, 0).getDate();
    const dateTo   = `${year}-${String(mon + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setMonthLoading(true);
    try {
      const records = await getAttendance({ date_from: dateFrom, date_to: dateTo });
      // Group records by date key YYYY-MM-DD
      const byDate = new Map<string, AttendanceRecord[]>();
      for (const r of records) {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date)!.push(r);
      }
      setMonthRecords(byDate);
    } catch {
      setMonthRecords(new Map());
    } finally {
      setMonthLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'attendance') loadMonthAttendance(calendarMonth);
  }, [tab, calendarMonth, loadMonthAttendance]);

  // Load full group details (with member lists) when groups tab is active
  useEffect(() => {
    if (tab !== 'groups' || groups.length === 0) return;
    Promise.all(groups.map((g) => getGroup(g.id))).then((details) => {
      setGroupDetails(new Map(details.map((d) => [d.id, d])));
    }).catch(() => {});
  }, [tab, groups]);

  function buildFullNumber() {
    const local = addLocalNumber.replace(/\D/g, '');
    const code = addCountryCode.replace(/\D/g, '');
    return code + local;
  }

  async function handleAddEmployee() {
    const fullNumber = buildFullNumber();
    if (!addName.trim() || fullNumber.length < 7) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await addEmployee(addName.trim(), fullNumber);
      setShowAdd(false);
      setAddName(''); setAddLocalNumber(''); setAddCountryCode('91');
      load();
    } catch (e: unknown) {
      setAddError((e as Error).message || 'Failed to add employee');
    } finally {
      setAddLoading(false);
    }
  }


  async function handleResendInvite(emp: WaEmployee) {
    try {
      await resendInvite(emp.id);
      addToast(`Invite resent to ${emp.name}`, 'success');
      load();
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to resend invite', 'error');
    }
  }

  function handleToggleActive(emp: WaEmployee) {
    if (emp.is_active) {
      openConfirm({
        title: `Deactivate ${emp.name}?`,
        message: 'They will stop receiving work assignments. You can reactivate them anytime.',
        confirmLabel: 'Deactivate',
        destructive: true,
        onConfirm: async () => {
          try {
            await updateEmployee(emp.id, { is_active: false });
            addToast(`${emp.name} deactivated`, 'info');
            load();
          } catch (e: unknown) {
            addToast((e as Error).message || 'Failed to deactivate', 'error');
          }
        },
      });
    } else {
      openConfirm({
        title: `Reactivate ${emp.name}?`,
        message: 'They will receive a new WhatsApp invite to accept.',
        confirmLabel: 'Reactivate',
        onConfirm: async () => {
          try {
            await updateEmployee(emp.id, { is_active: true });
            addToast(`${emp.name} reactivated — invite sent`, 'success');
            load();
          } catch (e: unknown) {
            addToast((e as Error).message || 'Failed to reactivate', 'error');
          }
        },
      });
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return;
    try {
      await createGroup({ name: groupName.trim(), description: groupDesc.trim() || undefined, employee_ids: groupEmployeeIds });
      addToast(`Group "${groupName.trim()}" created`, 'success');
      setShowCreateGroup(false); setGroupName(''); setGroupDesc(''); setGroupEmployeeIds([]);
      load();
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to create group', 'error');
    }
  }

  function handleDeleteGroup(group: WaEmployeeGroup | WaEmployeeGroupDetail) {
    openConfirm({
      title: `Delete "${group.name}"?`,
      message: 'This will remove the group and all its member links. Work assignments using this group will be unaffected.',
      confirmLabel: 'Delete Group',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteGroup(group.id);
          addToast(`Group "${group.name}" deleted`, 'info');
          setSelectedGroup(null);
          load();
        } catch (e: unknown) {
          addToast((e as Error).message || 'Failed to delete group', 'error');
        }
      },
    });
  }

  function handleRemoveEmployee(emp: WaEmployee) {
    openConfirm({
      title: `Remove ${emp.name}?`,
      message: 'This permanently removes them from your business. They will stop receiving any messages. This cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEmployee(emp.id);
          addToast(`${emp.name} removed`, 'info');
          setSelectedEmployee(null);
          load();
        } catch (e: unknown) {
          addToast((e as Error).message || 'Failed to remove employee', 'error');
        }
      },
    });
  }

  async function handleSendCheckin() {
    setCheckinSending(true);
    try {
      const result = await sendDailyCheckin();
      const msg = `Check-in sent to ${result.sent} employee${result.sent !== 1 ? 's' : ''}${result.failed ? `. ${result.failed} failed.` : '!'}`;
      addToast(msg, result.failed ? 'info' : 'success');
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to send check-in', 'error');
    } finally {
      setCheckinSending(false);
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await updateWaSettings({
        wa_employee_channel_id: settingsChannelId ? Number(settingsChannelId) : null,
        task_template_name: settingsTaskTemplate.trim() || null,
        checkin_schedule_time: settingsCheckinTime.trim() || null,
        checkin_schedule_enabled: settingsCheckinEnabled,
      });
      setSettingsSaved(true);
      addToast('Settings saved', 'success');
      setTimeout(() => setSettingsSaved(false), 3000);
      load();
    } catch (e: unknown) {
      addToast((e as Error).message || 'Failed to save settings', 'error');
    } finally {
      setSettingsSaving(false);
    }
  }

  const activeCount   = employees.filter((e) => e.status === 'active').length;
  const pendingCount  = employees.filter((e) => e.status === 'pending_acceptance').length;
  const rejectedCount = employees.filter((e) => e.status === 'rejected').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Phone className="w-6 h-6 text-green-600" />
            WhatsApp Team
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Employees receive an Accept/Decline invite · Verified via button tap, no OTP
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border-color rounded-lg hover:bg-bg-secondary text-text-primary"
          >
            <Plus className="w-4 h-4" /> Bulk Add
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-primary border border-border-color rounded-xl p-4">
          <div className="text-2xl font-bold text-text-primary">{employees.length}</div>
          <div className="text-sm text-text-secondary mt-1">Total</div>
        </div>
        <div className="bg-bg-primary border border-border-color rounded-xl p-4">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-sm text-text-secondary mt-1">Active</div>
        </div>
        <div className="bg-bg-primary border border-border-color rounded-xl p-4">
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          <div className="text-sm text-text-secondary mt-1">Invite Sent</div>
        </div>
        <div className="bg-bg-primary border border-border-color rounded-xl p-4">
          <div className="text-2xl font-bold text-red-500">{rejectedCount}</div>
          <div className="text-sm text-text-secondary mt-1">Declined</div>
        </div>
      </div>

      {/* Channel warning */}
      {!loading && settings && !settings.wa_employee_channel_id && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3 mb-4">
          <Wifi className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">No WhatsApp channel selected</p>
            <p className="text-xs text-red-600 mt-0.5">Employees cannot receive invites or tasks until you select a WhatsApp channel.</p>
          </div>
          <button onClick={() => setTab('settings')} className="flex-shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">Configure</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-color mb-6">
        {([
          { key: 'employees', label: 'Employees' },
          { key: 'groups',    label: 'Groups' },
          { key: 'attendance',label: 'Attendance' },
          { key: 'settings',  label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
        ] as { key: Tab; label: string; icon?: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'text-green-700 border-b-2 border-green-600' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="h-8 w-48 bg-bg-secondary rounded-lg animate-pulse" />
          <div className="bg-bg-primary border border-border-color rounded-xl overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-color last:border-0">
                <div className="h-4 bg-bg-secondary rounded animate-pulse w-36" />
                <div className="h-4 bg-bg-secondary rounded animate-pulse w-28" />
                <div className="h-5 bg-bg-secondary rounded-full animate-pulse w-20" />
                <div className="h-4 bg-bg-secondary rounded animate-pulse w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-800 dark:text-red-400">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Employees Tab ── */}
      {!loading && tab === 'employees' && (
        <EmployeeTable
          employees={employees}
          groups={groups}
          onRowClick={setSelectedEmployee}
          onResendInvite={handleResendInvite}
          onToggleActive={handleToggleActive}
          onRemove={handleRemoveEmployee}
          onAddEmployee={() => setShowAdd(true)}
        />
      )}

      {/* ── Groups Tab ── */}
      {!loading && tab === 'groups' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Create Group
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-16 text-text-secondary bg-bg-primary border border-border-color rounded-xl">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-text-primary">No groups yet</p>
              <p className="text-sm mt-1">Create groups to assign work to multiple employees at once</p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                <Plus className="w-4 h-4" /> Create First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => {
                const detail  = groupDetails.get(group.id);
                const members = detail?.members ?? [];
                const SHOW    = 5;
                const extra   = Math.max(0, members.length - SHOW);
                const avatarColors = ['bg-violet-100 text-violet-800','bg-blue-100 text-blue-800','bg-emerald-100 text-emerald-800','bg-orange-100 text-orange-800','bg-pink-100 text-pink-800'];
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(detail ?? null)}
                    className="bg-bg-primary border border-border-color rounded-xl p-4 text-left hover:border-accent/40 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                          {group.name}
                        </h3>
                        {group.description && (
                          <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{group.description}</p>
                        )}
                      </div>
                      <div className="w-5 h-5 rounded-full bg-bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>

                    {/* Avatar stack */}
                    <div className="flex items-center gap-2 mt-3">
                      {members.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {members.slice(0, SHOW).map((m, i) => (
                            <div
                              key={m.id}
                              title={m.name}
                              className={`h-6 w-6 rounded-full border-2 border-bg-primary flex items-center justify-center text-[10px] font-bold ${avatarColors[i % avatarColors.length]}`}
                            >
                              {m.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                          ))}
                          {extra > 0 && (
                            <div className="h-6 w-6 rounded-full border-2 border-bg-primary bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary">
                              +{extra}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-bg-secondary flex items-center justify-center">
                          <Users className="w-3 h-3 text-text-secondary opacity-50" />
                        </div>
                      )}
                      <span className="text-xs text-text-secondary">
                        {group.employee_count} member{group.employee_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Attendance Tab ── */}
      {!loading && tab === 'attendance' && (
        <div className="space-y-5">
          {/* Monthly heatmap calendar */}
          <AttendanceCalendar
            month={calendarMonth}
            records={monthRecords}
            selectedDate={selectedCalendarDate}
            activeEmployeeCount={activeCount}
            onDaySelect={(date) => {
              setSelectedCalendarDate(date);
              // Sync export date pickers to clicked day by default
              setExportDateFrom(date);
              setExportDateTo(date);
            }}
            onMonthChange={(newMonth) => setCalendarMonth(newMonth)}
            loading={monthLoading}
          />

          {/* Day detail header */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-blue-400" />
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              {selectedCalendarDate
                ? formatDate(selectedCalendarDate)
                : 'Select a date'}
            </p>
          </div>

          {/* Day detail table */}
          <AttendanceDayTable
            date={selectedCalendarDate}
            records={monthRecords.get(selectedCalendarDate) ?? []}
            activeEmployeeCount={activeCount}
            checkinSending={checkinSending}
            exportDateFrom={exportDateFrom}
            exportDateTo={exportDateTo}
            onSendCheckin={handleSendCheckin}
            onExportDateFromChange={setExportDateFrom}
            onExportDateToChange={setExportDateTo}
          />
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          {/* Channel selection */}
          <div className={`bg-bg-primary rounded-xl p-5 space-y-4 ${!settings?.wa_employee_channel_id ? 'border-2 border-red-300' : 'border border-border-color'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Employee WhatsApp Channel</h3>
              {!settings?.wa_employee_channel_id
                ? <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-300 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3 inline mr-1" />Required</span>
                : <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-300 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3 inline mr-1" />Configured</span>}
            </div>
            <p className="text-sm text-text-secondary">Which WhatsApp number sends invites, tasks, and attendance to employees.</p>
            {(settings?.available_channels || []).length === 0 ? (
              <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-800">
                No WhatsApp channels connected. Go to <strong>Settings → Channels</strong> first.
              </div>
            ) : (
              <select
                value={settingsChannelId}
                onChange={(e) => setSettingsChannelId(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary ${!settingsChannelId ? 'border-red-300' : 'border-border-color'}`}
              >
                <option value="">— Select a WhatsApp channel —</option>
                {(settings?.available_channels || []).map((ch) => (
                  <option key={ch.id} value={String(ch.id)}>
                    {ch.name} — {ch.phone_number || ch.phone_number_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Task template */}
          <div className="bg-bg-primary border border-border-color rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-text-primary">Task Template Name <span className="text-xs font-normal text-text-secondary ml-1">Optional</span></h3>
            <p className="text-sm text-text-secondary">Meta-approved utility template for sending tasks outside the 24hr window.</p>
            <input
              value={settingsTaskTemplate}
              onChange={(e) => setSettingsTaskTemplate(e.target.value)}
              placeholder="e.g. task_assignment"
              className="w-full border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary placeholder:text-text-secondary"
            />
            <p className="text-xs text-text-secondary">
              Variables: <code className="bg-bg-secondary px-1 rounded">{'{{1}}'}</code> = task title,{' '}
              <code className="bg-bg-secondary px-1 rounded">{'{{2}}'}</code> = employee name,{' '}
              <code className="bg-bg-secondary px-1 rounded">{'{{3}}'}</code> = due date
            </p>
          </div>

          {/* Check-in schedule */}
          <div className="bg-bg-primary border border-border-color rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Daily Check-in Schedule</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-text-secondary">{settingsCheckinEnabled ? 'Enabled' : 'Disabled'}</span>
                <button
                  onClick={() => setSettingsCheckinEnabled(!settingsCheckinEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settingsCheckinEnabled ? 'bg-green-600' : 'bg-border-color'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settingsCheckinEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>
            <p className="text-sm text-text-secondary">
              At this time (UTC) every day, all active employees automatically receive a
              <strong> "✅ I'm in Office"</strong> check-in button on WhatsApp.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={settingsCheckinTime}
                onChange={(e) => setSettingsCheckinTime(e.target.value)}
                disabled={!settingsCheckinEnabled}
                className="border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 bg-bg-primary text-text-primary"
              />
              <span className="text-sm text-text-secondary">UTC time</span>
            </div>
            {settingsCheckinEnabled && !settingsCheckinTime && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Please set a time or disable the schedule.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {settingsSaving ? 'Saving...' : settingsSaved ? '✅ Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await fetch('/api/v1/wa/employees/repair-contacts', { method: 'POST', headers: { Authorization: `Bearer ${document.cookie.match(/access_token=([^;]+)/)?.[1] || ''}` } });
                  const data = await r.json();
                  addToast(`Repair complete: ${data.repaired} fixed, ${data.already_ok} ok${data.failed ? `, ${data.failed} failed` : ''}`, data.failed ? 'info' : 'success');
                  load();
                } catch {
                  addToast('Repair failed', 'error');
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-secondary"
            >
              <RefreshCw className="w-4 h-4" /> Repair Contacts
            </button>
          </div>
        </div>
      )}

      {/* ── Add Employee Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-primary rounded-xl p-6 w-full max-w-sm shadow-xl border border-border-color">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">Add Employee</h2>
              <button onClick={() => { setShowAdd(false); setAddError(null); setAddLocalNumber(''); }}><X className="w-5 h-5 text-text-secondary" /></button>
            </div>

            {/* How it works mini-banner */}
            <div className="bg-green-50 border border-green-300 rounded-lg px-3 py-2 mb-4 text-xs text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400">
              <p className="font-semibold">How it works</p>
              <p>An <strong>Accept / Decline</strong> button will be sent to this WhatsApp number. No OTP needed.</p>
            </div>

            {settings && !settings.wa_employee_channel_id && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 mb-3">
                <Wifi className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">No WhatsApp channel selected — invite can't be sent.{' '}
                  <button onClick={() => { setShowAdd(false); setTab('settings'); }} className="underline">Configure →</button>
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text-primary">Full Name</label>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="mt-1 w-full border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary placeholder:text-text-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">WhatsApp Number</label>
                <div className="mt-1 flex gap-1">
                  <select
                    value={addCountryCode}
                    onChange={(e) => setAddCountryCode(e.target.value)}
                    className="border border-border-color rounded-lg px-2 py-2 text-sm bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-green-500 w-28 flex-shrink-0"
                  >
                    <option value="91">🇮🇳 +91</option>
                    <option value="1">🇺🇸 +1</option>
                    <option value="44">🇬🇧 +44</option>
                    <option value="971">🇦🇪 +971</option>
                    <option value="966">🇸🇦 +966</option>
                    <option value="65">🇸🇬 +65</option>
                    <option value="60">🇲🇾 +60</option>
                    <option value="880">🇧🇩 +880</option>
                    <option value="92">🇵🇰 +92</option>
                    <option value="94">🇱🇰 +94</option>
                    <option value="977">🇳🇵 +977</option>
                  </select>
                  <input
                    value={addLocalNumber}
                    onChange={(e) => setAddLocalNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    maxLength={15}
                    className="flex-1 border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary placeholder:text-text-secondary"
                  />
                </div>
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAdd(false); setAddError(null); setAddLocalNumber(''); }} className="flex-1 border border-border-color rounded-lg py-2 text-sm text-text-primary hover:bg-bg-secondary">Cancel</button>
              <button
                onClick={handleAddEmployee}
                disabled={addLoading || !addName.trim() || addLocalNumber.length < 7}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {addLoading ? 'Adding...' : '📨 Add & Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Add Modal ── */}
      <BulkAddModal
        open={showBulk}
        existingEmployees={employees}
        onClose={() => setShowBulk(false)}
        onSuccess={(created, skipped) => {
          const msg = `Added ${created} employee${created !== 1 ? 's' : ''}${skipped ? `. Skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}.` : '!'}`;
          addToast(msg, 'success');
          load();
        }}
      />

      {/* ── Create Group Modal ── */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-primary rounded-xl p-6 w-full max-w-md shadow-xl border border-border-color">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text-primary">Create Group</h2>
              <button onClick={() => setShowCreateGroup(false)}><X className="w-5 h-5 text-text-secondary" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text-primary">Group Name</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Sales Team, Delivery Boys..."
                  className="mt-1 w-full border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary placeholder:text-text-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary">Description (optional)</label>
                <input
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="e.g. Field sales agents"
                  className="mt-1 w-full border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-bg-primary text-text-primary placeholder:text-text-secondary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">Add Members</label>
                <div className="max-h-48 overflow-y-auto border border-border-color rounded-lg divide-y divide-border-color">
                  {employees.filter((e) => e.status === 'active').map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-bg-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupEmployeeIds.includes(emp.id)}
                        onChange={(e) =>
                          setGroupEmployeeIds((prev) =>
                            e.target.checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)
                          )
                        }
                        className="accent-green-600"
                      />
                      <span className="text-sm text-text-primary">{emp.name}</span>
                      <span className="text-xs text-text-secondary">+{emp.whatsapp_number}</span>
                    </label>
                  ))}
                  {employees.filter((e) => e.status === 'active').length === 0 && (
                    <p className="text-sm text-text-secondary p-3">No active employees available</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreateGroup(false)} className="flex-1 border border-border-color rounded-lg py-2 text-sm text-text-primary hover:bg-bg-secondary">Cancel</button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global overlays ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog config={confirmConfig} />
      <GroupDetailPanel
        group={selectedGroup}
        allEmployees={employees}
        onClose={() => setSelectedGroup(null)}
        onChanged={async () => {
          await load();
          // Refresh the specific group detail so the panel reflects latest data
          if (selectedGroup) {
            getGroup(selectedGroup.id).then((d) => {
              setSelectedGroup(d);
              setGroupDetails((prev) => new Map(prev).set(d.id, d));
            }).catch(() => {});
          }
        }}
        onRequestDelete={handleDeleteGroup}
        addToast={addToast}
      />
      <EmployeeSlideOver
        employee={selectedEmployee}
        groups={groups}
        onClose={() => setSelectedEmployee(null)}
        onResendInvite={(emp) => { setSelectedEmployee(null); handleResendInvite(emp); }}
        onToggleActive={(emp) => { setSelectedEmployee(null); handleToggleActive(emp); }}
        onRemove={handleRemoveEmployee}
      />

    </div>
  );
}
