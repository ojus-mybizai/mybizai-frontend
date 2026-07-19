'use client';

import { Clock, Send, LogIn, LogOut, Download } from 'lucide-react';
import type { AttendanceRecord } from '@/services/waEmployees';

/* ── Avatar helpers ────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-800',
  'bg-blue-100   text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100   text-pink-800',
  'bg-cyan-100   text-cyan-800',
  'bg-amber-100  text-amber-800',
  'bg-rose-100   text-rose-800',
];

function avatarColor(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Constants ──────────────────────────────────────────────────────────────  */

const FULL_DAY_HOURS = 8;

/* ── Component ──────────────────────────────────────────────────────────────  */

interface Props {
  date: string;                         // YYYY-MM-DD
  records: AttendanceRecord[];
  activeEmployeeCount: number;
  checkinSending: boolean;
  exportDateFrom: string;
  exportDateTo: string;
  onSendCheckin: () => void;
  onExportDateFromChange: (v: string) => void;
  onExportDateToChange: (v: string) => void;
}

export function AttendanceDayTable({
  date,
  records,
  activeEmployeeCount,
  checkinSending,
  exportDateFrom,
  exportDateTo,
  onSendCheckin,
  onExportDateFromChange,
  onExportDateToChange,
}: Props) {
  /* Friendly date label */
  const displayDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  /* Summary stats */
  const checkedIn  = records.filter((r) => r.check_in_at).length;
  const checkedOut = records.filter((r) => r.check_out_at).length;
  const hoursArr   = records.map((r) => r.work_hours).filter((h): h is number => h != null);
  const avgHours   = hoursArr.length > 0 ? hoursArr.reduce((s, h) => s + h, 0) / hoursArr.length : null;

  return (
    <div className="space-y-3">
      {/* ── Day header + action bar ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{displayDate}</p>
          {records.length > 0 && (
            <p className="text-xs text-text-secondary mt-0.5">
              {checkedIn} checked&nbsp;in
              {checkedOut > 0 && ` · ${checkedOut} checked&nbsp;out`}
              {avgHours != null && ` · avg&nbsp;${avgHours.toFixed(1)}&nbsp;hrs`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Send check-in */}
          <button
            onClick={onSendCheckin}
            disabled={checkinSending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {checkinSending ? 'Sending…' : 'Send Check-in Now'}
          </button>

          {/* Export range */}
          <div className="flex items-center gap-1.5 bg-bg-secondary border border-border-color rounded-lg px-2.5 py-1.5 text-xs text-text-secondary">
            <Download className="w-3 h-3 shrink-0" />
            <input
              type="date"
              value={exportDateFrom}
              onChange={(e) => onExportDateFromChange(e.target.value)}
              className="border-0 bg-transparent text-xs text-text-primary focus:outline-none w-[6.5rem]"
            />
            <span className="select-none">→</span>
            <input
              type="date"
              value={exportDateTo}
              onChange={(e) => onExportDateToChange(e.target.value)}
              className="border-0 bg-transparent text-xs text-text-primary focus:outline-none w-[6.5rem]"
            />
            <a
              href={`/api/v1/wa/employees/attendance/export?date_from=${exportDateFrom}&date_to=${exportDateTo}`}
              className="ml-0.5 px-2 py-0.5 bg-bg-primary border border-border-color rounded text-xs font-medium text-text-primary hover:bg-bg-secondary transition-colors"
            >
              CSV
            </a>
          </div>
        </div>
      </div>

      {/* ── Table / empty state ── */}
      <div className="bg-bg-primary border border-border-color rounded-xl overflow-hidden">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center opacity-50">
              <Clock className="w-5 h-5 text-text-secondary" />
            </div>
            <p className="font-medium text-text-primary text-sm">No records for this day</p>
            <p className="text-xs text-text-secondary">Send the check-in button to start tracking</p>
            <button
              onClick={onSendCheckin}
              disabled={checkinSending}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {checkinSending ? 'Sending…' : 'Send Check-in Now'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary border-b border-border-color">
                <tr>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap">
                    Employee
                  </th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <LogIn className="w-3 h-3" /> Check&nbsp;In
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <LogOut className="w-3 h-3" /> Check&nbsp;Out
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap">
                    Work Hours
                  </th>
                  <th className="text-left px-4 py-2.5 text-text-secondary font-medium text-xs whitespace-nowrap hidden sm:table-cell">
                    Method
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-color">
                {records.map((r) => {
                  const pct    = Math.min(1, (r.work_hours ?? 0) / FULL_DAY_HOURS);
                  const barCls = pct >= 1 ? 'bg-green-500' : pct >= 0.5 ? 'bg-yellow-400' : 'bg-orange-400';

                  return (
                    <tr key={r.id} className="hover:bg-bg-secondary transition-colors group">
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(r.employee_name)}`}
                          >
                            {initials(r.employee_name)}
                          </div>
                          <span className="font-medium text-text-primary">{r.employee_name}</span>
                        </div>
                      </td>

                      {/* Check In */}
                      <td className="px-4 py-3">
                        {r.check_in_at ? (
                          <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            {fmtTime(r.check_in_at)}
                          </span>
                        ) : (
                          <span className="text-text-secondary/40">—</span>
                        )}
                      </td>

                      {/* Check Out */}
                      <td className="px-4 py-3">
                        {r.check_out_at ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            {fmtTime(r.check_out_at)}
                          </span>
                        ) : (
                          <span className="text-text-secondary/40">—</span>
                        )}
                      </td>

                      {/* Work Hours — mini progress bar */}
                      <td className="px-4 py-3">
                        {r.work_hours != null ? (
                          <div className="flex items-center gap-2 min-w-[7rem]">
                            <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${barCls}`}
                                style={{ width: `${pct * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-text-primary tabular-nums shrink-0">
                              {r.work_hours.toFixed(1)}<span className="text-text-secondary">/{FULL_DAY_HOURS}h</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-secondary/40">—</span>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {r.check_in_method ? (
                          <span
                            className={[
                              'inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium capitalize',
                              r.check_in_method === 'whatsapp'
                                ? 'bg-green-50 text-green-800 border-green-300 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                                : r.check_in_method === 'manual'
                                ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                : 'bg-bg-secondary text-text-secondary border-border-color',
                            ].join(' ')}
                          >
                            {r.check_in_method}
                          </span>
                        ) : (
                          <span className="text-text-secondary/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance how-it-works note */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-semibold mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" /> How attendance works
        </p>
        <ul className="list-disc ml-4 space-y-1 text-xs text-blue-700 dark:text-blue-400">
          <li><strong>Check-in:</strong> At your configured time, employees receive a <em>"✅ I'm in Office"</em> button on WhatsApp — tapping records arrival.</li>
          <li><strong>Check-out:</strong> Employee types <em>leaving</em> → receives a <em>"🏠 Confirm Check-out"</em> button — tapping records departure.</li>
          <li>Click <strong>Send Check-in Now</strong> to manually trigger today's check-in outside the schedule.</li>
          <li>Use the Export CSV range picker to download records for any date window.</li>
        </ul>
      </div>
    </div>
  );
}
