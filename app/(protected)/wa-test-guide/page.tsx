'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, Copy,
  Phone, MessageCircle, Send, ExternalLink, AlertTriangle,
  Zap, Users, FileText, ClipboardCheck, Info,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Step {
  id: string;
  text: string;
  detail?: string;
  code?: string;
  warn?: string;
}

interface Section {
  id: string;
  phase: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  prereq?: string;
  steps: Step[];
}

/* ─── Data ────────────────────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    id: 'prereq',
    phase: '0',
    title: 'Prerequisites',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'border-orange-300 bg-orange-50',
    steps: [
      {
        id: 'p1',
        text: 'A WhatsApp Business API channel must be connected in Settings → Channels',
        detail: 'Go to Channels → Connect WhatsApp → enter your Phone Number ID and Access Token from Meta Business Suite. The channel must show "Connected" status.',
      },
      {
        id: 'p2',
        text: 'Meta webhook must be live and receiving events',
        detail: 'The webhook endpoint is /api/v1/meta/webhook. Verify it is reachable from the internet. For local dev, use ngrok or a tunnel.',
        code: 'GET /api/v1/meta/webhook/health  →  {"status":"healthy"}',
      },
      {
        id: 'p3',
        text: 'You need a real WhatsApp number to receive OTPs and task messages',
        detail: 'Use your own phone or a test number. The number must have WhatsApp installed and be reachable by your connected business number.',
      },
      {
        id: 'p4',
        text: 'Backend is running and new WA tables are created',
        detail: 'Restart the backend once — schema patches v19-v21 create all required tables and columns including contact_id, otp_attempt_count, and otp_locked_until.',
        code: 'Tables: wa_employees, wa_employee_groups, wa_employee_group_members,\n        wa_templates, wa_work_items, wa_work_assignments, wa_attendance',
      },
      {
        id: 'p5',
        text: '(Recommended) Configure channel settings in WA Team → Settings tab',
        detail: 'If you have multiple WhatsApp channels, designate one specifically for employee management. Optionally configure pre-approved Meta template names for OTP and task delivery — this allows sending outside the 24-hour re-engagement window.',
        code: 'Settings tab fields:\n• Employee WA Channel — which number handles employee messages\n• OTP Template Name — Meta-approved template for OTP (e.g. "employee_otp_v1")\n• Task Template Name — Meta-approved template for tasks (e.g. "employee_task_v1")',
      },
    ],
  },
  {
    id: 'employees',
    phase: '1',
    title: 'Add & Verify Employees',
    icon: <Phone className="w-5 h-5" />,
    color: 'border-green-300 bg-green-50',
    prereq: 'Complete Phase 0 first',
    steps: [
      {
        id: 'e1',
        text: 'Open WA Team in the sidebar (or navigate to /wa-employees)',
      },
      {
        id: 'e2',
        text: 'Click "Add Employee" → enter a name and a real WhatsApp number',
        detail: 'Enter the number in any format: 9876543210 (10-digit), +919876543210, or 919876543210. The system auto-adds the India prefix (91) for 10-digit numbers.',
        code: 'Test data:\nName: Rahul Test\nNumber: 9876543210   ← replace with your real number',
      },
      {
        id: 'e3',
        text: 'Check your WhatsApp — you should receive an OTP message from your business number',
        detail: 'The message reads: "You have been added as an employee of [Business Name] on MyBizAI. Your verification code is XXXXXX."',
        warn: 'If no OTP arrives: check that the channel is connected and your backend can reach graph.facebook.com. Also verify the number format has the correct country code in the database.',
      },
      {
        id: 'e4',
        text: 'Click "Enter OTP" on the employee row → type the 6-digit code → click Verify',
        detail: 'After successful verification, the status badge changes from "Pending OTP" (yellow) to "Verified" (green). The system also creates a linked Contact with AI routing bypassed so messages from this employee never reach the customer AI.',
      },
      {
        id: 'e4b',
        text: '(Alternative) Employee can self-verify by replying on WhatsApp: "VERIFY 123456"',
        detail: 'The employee sends VERIFY followed by the OTP code. The system verifies in real-time and replies with a confirmation message. This is the preferred flow for employees who have the OTP on their phone already.',
        code: 'Employee sends: VERIFY 123456\nSystem replies: ✅ You have been verified! Your manager can now assign tasks to you.',
      },
      {
        id: 'e5',
        text: 'Check the "AI Bypass Active" badge appears under the employee name',
        detail: 'The blue shield badge confirms contact_id is set — meaning messages from this employee number are excluded from the customer AI pipeline. If it shows "⚠ Not linked to contact", the employee should send any message on WhatsApp to trigger an automatic retry.',
      },
      {
        id: 'e5b',
        text: '(Optional) Test Resend OTP — click the refresh icon on a pending employee',
        detail: 'A new 6-digit code is generated and the old one is invalidated. The OTP expires in 10 minutes. After 5 failed attempts, the account is locked for 30 minutes.',
      },
      {
        id: 'e6',
        text: '(Optional) Test Bulk Add — click "Bulk Add" and paste a CSV list',
        code: 'Format: one employee per line\n\nRahul Sharma, 9876543210\nPriya Singh, 8765432109\nAmit Kumar, 7654321098',
        detail: 'Each employee gets an OTP simultaneously. Duplicates are skipped and reported.',
      },
    ],
  },
  {
    id: 'groups',
    phase: '2',
    title: 'Create Employee Groups',
    icon: <Users className="w-5 h-5" />,
    color: 'border-blue-300 bg-blue-50',
    prereq: 'Need at least 1 verified employee from Phase 1',
    steps: [
      {
        id: 'g1',
        text: 'On the WA Team page, click the "Groups" tab',
      },
      {
        id: 'g2',
        text: 'Click "Create Group" → name it (e.g. "Sales Team") → tick verified employees → Create',
        detail: 'Only verified (active) employees appear in the group picker. Groups let you assign work to multiple employees in one action.',
      },
      {
        id: 'g3',
        text: 'Verify the group card shows the correct employee count',
      },
    ],
  },
  {
    id: 'templates',
    phase: '3',
    title: 'Create Templates',
    icon: <MessageCircle className="w-5 h-5" />,
    color: 'border-purple-300 bg-purple-50',
    steps: [
      {
        id: 't1',
        text: 'Open WA Templates in the sidebar',
      },
      {
        id: 't2',
        text: 'Create a Simple Task template',
        detail: 'Click New Template → select "Simple Task" → name it "Follow-up Call" → set message body → keep the default Done/Not Done buttons → Create.',
        code: 'Suggested message body:\n📋 *Task: {{task_title}}*\n\nHi {{employee_name}},\nPlease complete this task by {{due_date}}.',
      },
      {
        id: 't3',
        text: 'Verify the template card shows the message body and buttons',
      },
      {
        id: 't4',
        text: '(Optional) Create a WhatsApp Form template',
        detail: 'Select "WhatsApp Form" → click "Load daily report scaffold" to pre-fill 3 fields, or add fields manually using the field builder → Create.',
        warn: 'WhatsApp Forms require publishing to Meta (takes ~5 min). You need a WABA ID in your channel config. For initial testing, skip this and use Simple Task first.',
      },
      {
        id: 't5',
        text: '(Optional) Publish a WhatsApp Form to Meta',
        detail: 'On the form template card, click the upload icon → system calls Meta API to create the Flow → on success, the card shows "Live" badge and a Flow ID.',
        warn: 'Publishing requires: channel has waba_id in config, access token has manage_business_extension permission.',
      },
    ],
  },
  {
    id: 'dispatch',
    phase: '4',
    title: 'Dispatch Work & Receive on WhatsApp',
    icon: <Send className="w-5 h-5" />,
    color: 'border-green-300 bg-green-50',
    prereq: 'Need at least 1 verified employee and 1 template',
    steps: [
      {
        id: 'd1',
        text: 'Open WA Work in the sidebar',
      },
      {
        id: 'd2',
        text: 'Click "Assign Work" → fill title, pick the Simple Task template, select employee(s)',
        code: 'Test data:\nTitle: Call 5 leads from yesterday\nTemplate: Follow-up Call (Simple Task)\nAssign to: [your test employee]\nDue: today\nSend immediately: ✓ checked',
      },
      {
        id: 'd3',
        text: 'Click "Assign & Send" — check your WhatsApp immediately',
        detail: 'You should receive an interactive message with the task title and the Done / Not Done buttons.',
        warn: 'If no message arrives within 5 seconds, you may be outside the 24-hour window (WhatsApp error 131047). In that case, reply "Hi" from the employee phone first to open the conversation window, then the task will be delivered automatically.',
      },
      {
        id: 'd3b',
        text: 'Test pull-based delivery: employee sends any message → system delivers pending tasks',
        detail: 'If the 24hr window is closed, tasks stay queued. When the employee next sends any message (even "hi"), the system immediately delivers all pending assignments. The "Awaiting Reply" badge shows tasks that were sent but not yet responded to.',
        code: 'Pull-based flow:\n1. Employee opens WhatsApp → sends "Hi"\n2. Backend webhook fires → detects employee\n3. deliver_pending_for_employee() runs → sends all pending tasks\n4. Employee receives tasks with interactive buttons',
      },
      {
        id: 'd4',
        text: 'On your WhatsApp, tap "✅ Done" — go back to WA Work and click the work item',
        detail: 'The right-side drawer opens. The assignment row for your employee should show status "done" (green badge) and a responded_at timestamp. This confirms the webhook → button handler pipeline is working.',
      },
      {
        id: 'd5',
        text: 'Verify the progress bar on the work item card updates to 100%',
      },
      {
        id: 'd6',
        text: '(Optional) Test "Not Done" — create another work item, tap ❌ Not Done on WhatsApp',
        detail: 'Assignment status should show "not_done" (red badge) in the drawer.',
      },
      {
        id: 'd7',
        text: '(Optional) Test Manual Override — in the drawer, use "Mark Done" / "Not Done" buttons',
        detail: 'Owner can override any assignment status directly from the dashboard without employee action.',
      },
      {
        id: 'd8',
        text: '(Optional) Test Draft + Manual Dispatch',
        detail: 'Uncheck "Send immediately" when creating → work saves as Draft. Click the Dispatch button in the drawer to send it later.',
      },
    ],
  },
  {
    id: 'attendance',
    phase: '5',
    title: 'Test Attendance (WhatsApp Check-in)',
    icon: <ClipboardCheck className="w-5 h-5" />,
    color: 'border-yellow-300 bg-yellow-50',
    prereq: 'Need a verified employee whose number is registered',
    steps: [
      {
        id: 'a1',
        text: 'From your test WhatsApp number, send "Hi" or "Good morning" to the business number',
        detail: 'The webhook detects the sender number, matches it to a WaEmployee, and creates an attendance check-in record for today.',
        code: 'Trigger words (case-insensitive):\nCheck-in:  hi, hello, start, good morning, gm, namaste, ready, office, present\nCheck-out: done, bye, leaving, finish, end, checkout, good night',
      },
      {
        id: 'a2',
        text: 'Open WA Team → Attendance tab → today\'s date should be selected',
        detail: 'Your employee row should show a Check In time. Method column shows "whatsapp".',
      },
      {
        id: 'a3',
        text: 'Send "Leaving" or "Done" from the same WhatsApp number',
        detail: 'The Check Out time should now populate in the attendance table.',
      },
      {
        id: 'a4',
        text: '(Optional) Test location attach — share your location on WhatsApp after checking in',
        detail: 'The backend handles location messages and attaches lat/lng to today\'s attendance record if check_in_lat is not yet set.',
      },
      {
        id: 'a5',
        text: '(Optional) Test Manual Attendance — pick a past date, click a different date in the picker',
        detail: 'No records for that date is expected. The owner can also set manual attendance via the API at POST /api/v1/wa/employees/attendance/manual.',
      },
    ],
  },
  {
    id: 'stats',
    phase: '6',
    title: 'Verify Stats & Completion Rate',
    icon: <Zap className="w-5 h-5" />,
    color: 'border-gray-300 bg-gray-50',
    steps: [
      {
        id: 's1',
        text: 'On the WA Work page, the 4 stat cards should update after each dispatch and response',
        detail: 'Total Items | Done assignments | Pending assignments | Completion Rate %',
      },
      {
        id: 's2',
        text: 'Assign work to a group → verify one assignment row per employee is created',
      },
      {
        id: 's3',
        text: 'Check API stats endpoint directly',
        code: 'GET /api/v1/wa/work/stats/summary\n\nExpected:\n{\n  "total_work_items": N,\n  "dispatched": N,\n  "total_assignments": N,\n  "done": N,\n  "pending": N,\n  "completion_rate": 66.7\n}',
      },
    ],
  },
];

/* ─── Clipboard helper ────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function WaTestGuidePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ prereq: true, employees: true });

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const totalSteps = SECTIONS.flatMap((s) => s.steps).length;
  const doneSteps = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-100 rounded-xl">
            <ClipboardCheck className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Work System — Test Guide</h1>
            <p className="text-sm text-gray-500 mt-0.5">Step-by-step testing checklist for the full WA employee & task pipeline</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-gray-900">{doneSteps}/{totalSteps} steps</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{pct}% complete — tick each step as you test it</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="mb-8 bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Jump to Phase</p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => {
            const done = s.steps.filter((st) => checked[st.id]).length;
            const total = s.steps.length;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50 transition-colors"
              >
                <span className="font-bold text-gray-400">P{s.phase}</span>
                <span className="text-gray-700">{s.title}</span>
                <span className={`ml-1 font-medium ${done === total ? 'text-green-600' : 'text-gray-400'}`}>
                  {done}/{total}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Page links */}
      <div className="mb-8 bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pages to Test</p>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/wa-employees', label: 'WA Team', icon: <Phone className="w-3.5 h-3.5" /> },
            { href: '/wa-templates', label: 'WA Templates', icon: <MessageCircle className="w-3.5 h-3.5" /> },
            { href: '/wa-work', label: 'WA Work', icon: <Send className="w-3.5 h-3.5" /> },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              {link.icon}
              {link.label}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          ))}
        </div>
      </div>

      {/* API reference */}
      <div className="mb-8 bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Key API Endpoints</p>
        <div className="space-y-1 font-mono text-xs text-gray-600">
          {[
            ['POST', '/api/v1/wa/employees', 'Add employee + send OTP'],
            ['POST', '/api/v1/wa/employees/verify-otp', 'Verify OTP → activate employee'],
            ['GET',  '/api/v1/wa/employees', 'List employees'],
            ['GET',  '/api/v1/wa/employees/attendance', 'Attendance for a date'],
            ['POST', '/api/v1/wa/templates', 'Create template'],
            ['POST', '/api/v1/wa/templates/{id}/publish-flow', 'Publish Flow to Meta'],
            ['POST', '/api/v1/wa/work', 'Create & dispatch work item'],
            ['GET',  '/api/v1/wa/work', 'List all work items'],
            ['GET',  '/api/v1/wa/work/stats/summary', 'Completion stats'],
            ['PATCH','/api/v1/wa/work/assignments/{id}/status', 'Manual status override'],
          ].map(([method, path, desc]) => (
            <div key={path + method} className="flex items-start gap-2">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                method === 'GET' ? 'bg-blue-100 text-blue-700' :
                method === 'POST' ? 'bg-green-100 text-green-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {method}
              </span>
              <span className="text-gray-700">{path}</span>
              <span className="text-gray-400 hidden sm:inline">— {desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const doneSectionSteps = section.steps.filter((s) => checked[s.id]).length;
          const allDone = doneSectionSteps === section.steps.length;
          const isExpanded = expanded[section.id] !== false;

          return (
            <div
              key={section.id}
              id={section.id}
              className={`border rounded-xl overflow-hidden ${section.color}`}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
              >
                <div className={`p-1.5 rounded-lg ${allDone ? 'bg-green-500 text-white' : 'bg-white/70 text-gray-600'}`}>
                  {allDone ? <CheckCircle2 className="w-5 h-5" /> : section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">Phase {section.phase}</span>
                    {section.prereq && (
                      <span className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-gray-500">
                        {section.prereq}
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-gray-900">{section.title}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-bold ${allDone ? 'text-green-600' : 'text-gray-500'}`}>
                    {doneSectionSteps}/{section.steps.length}
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {/* Steps */}
              {isExpanded && (
                <div className="bg-white divide-y">
                  {section.steps.map((step, i) => {
                    const isDone = checked[step.id];
                    return (
                      <div key={step.id} className={`p-4 ${isDone ? 'bg-green-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggle(step.id)}
                            className="mt-0.5 shrink-0"
                          >
                            {isDone
                              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                              : <Circle className="w-5 h-5 text-gray-300 hover:text-gray-400" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                              {step.text}
                            </p>

                            {step.detail && (
                              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{step.detail}</p>
                            )}

                            {step.code && (
                              <div className="mt-2 relative group">
                                <pre className="bg-gray-900 text-green-400 rounded-lg px-4 py-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                                  {step.code}
                                </pre>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CopyButton text={step.code} />
                                </div>
                              </div>
                            )}

                            {step.warn && (
                              <div className="mt-2 flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">{step.warn}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Troubleshooting */}
      <div className="mt-8 bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          Common Issues & Fixes
        </h2>
        <div className="space-y-4 text-sm">
          {[
            {
              problem: 'Employee gets no OTP on WhatsApp',
              fix: 'Check backend logs for "WA send error". Verify the channel has phone_number_id and access_token. The Meta access token may have expired — regenerate it in Meta Business Suite.',
            },
            {
              problem: 'Button tap on WhatsApp does not update dashboard',
              fix: 'The webhook must be publicly reachable. Check /api/v1/meta/webhook returns 200 on GET. Check that the phone_number_id in the webhook payload matches the channel config. Check backend logs for "Employee WA handler error".',
            },
            {
              problem: 'Work dispatch fails with "No connected WhatsApp channel"',
              fix: 'Go to Channels page, verify the WhatsApp channel shows is_connected=true. If not, reconnect it.',
            },
            {
              problem: '"No active verified employees found"',
              fix: 'Only employees with status="active" (verified OTP) can receive work. Go to WA Team, verify at least one employee has the green "Verified" badge.',
            },
            {
              problem: 'Flow publish fails with Meta API error',
              fix: 'Ensure the access token has manage_business_extension permission. The WABA ID in channel config must match the WABA that owns the phone number.',
            },
            {
              problem: 'Tables do not exist on startup',
              fix: 'Set RUN_DB_INIT=true in backend .env and restart once. This forces Base.metadata.create_all() to run and creates the new wa_* tables.',
              code: 'RUN_DB_INIT=true  # add to backend/.env, restart, then remove',
            },
          ].map(({ problem, fix, code }) => (
            <div key={problem} className="border rounded-lg p-3">
              <p className="font-medium text-gray-800 mb-1">❓ {problem}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{fix}</p>
              {code && (
                <pre className="mt-2 bg-gray-900 text-green-400 rounded px-3 py-2 text-xs font-mono">{code}</pre>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All done */}
      {doneSteps === totalSteps && (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-green-800">All {totalSteps} steps completed!</h2>
          <p className="text-green-700 mt-1 text-sm">
            The WhatsApp Work system is fully tested and operational.
          </p>
        </div>
      )}
    </div>
  );
}
