'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAgentStore } from '@/lib/agent-store';
import { formatDateTime } from '@/lib/format-date';
import {
  listAgentRuns,
  runAgentManually,
  listAvailableSkillsAndTriggers,
  type AgentRun,
  type TriggerConfig,
  type DynamicTrigger,
} from '@/services/agents';
import {
  Play,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pause,
  Activity,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Brain,
  Loader2,
  Save,
  Puzzle,
  Clock,
} from 'lucide-react';

// ─── Schedule Builder (cron ↔ friendly UI) ───────────────────

type Frequency = 'none' | 'daily' | 'weekly' | 'monthly';
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = ['00', '15', '30', '45'];

interface ScheduleState {
  frequency: Frequency;
  hour: number;      // 1–12
  minute: string;    // '00'|'15'|'30'|'45'
  ampm: 'AM' | 'PM';
  weekDays: number[]; // 0=Sun..6=Sat
  monthDay: number;   // 1–31
}

function parseCron(cron: string): ScheduleState {
  const blank: ScheduleState = { frequency: 'none', hour: 9, minute: '00', ampm: 'AM', weekDays: [1], monthDay: 1 };
  if (!cron.trim()) return blank;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return blank;
  const [min, hr, dom, , dow] = parts;
  const h24 = parseInt(hr, 10);
  const m = parseInt(min, 10);
  if (isNaN(h24) || isNaN(m)) return blank;
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = ['00', '15', '30', '45'].includes(String(m).padStart(2, '0')) ? String(m).padStart(2, '0') : '00';
  if (dow !== '*') {
    return { frequency: 'weekly', hour, minute, ampm, weekDays: dow.split(',').map(Number).filter((d) => !isNaN(d)), monthDay: 1 };
  }
  if (dom !== '*') {
    return { frequency: 'monthly', hour, minute, ampm, weekDays: [1], monthDay: parseInt(dom, 10) || 1 };
  }
  return { frequency: 'daily', hour, minute, ampm, weekDays: [1], monthDay: 1 };
}

function buildCron(s: ScheduleState): string {
  if (s.frequency === 'none') return '';
  const m = parseInt(s.minute, 10);
  const h = s.ampm === 'PM' ? (s.hour === 12 ? 12 : s.hour + 12) : (s.hour === 12 ? 0 : s.hour);
  if (s.frequency === 'daily') return `${m} ${h} * * *`;
  if (s.frequency === 'weekly') return `${m} ${h} * * ${(s.weekDays.length ? s.weekDays : [1]).sort().join(',')}`;
  if (s.frequency === 'monthly') return `${m} ${h} ${s.monthDay} * *`;
  return '';
}

function humanCron(s: ScheduleState): string {
  if (s.frequency === 'none') return 'No schedule — event triggers only';
  const time = `${s.hour}:${s.minute} ${s.ampm}`;
  if (s.frequency === 'daily') return `Every day at ${time}`;
  if (s.frequency === 'weekly') {
    const days = (s.weekDays.length ? s.weekDays : [1]).sort().map((d) => DAYS_OF_WEEK[d]).join(', ');
    return `Every week on ${days} at ${time}`;
  }
  if (s.frequency === 'monthly') return `Every month on day ${s.monthDay} at ${time}`;
  return '';
}

function ScheduleBuilder({ cron, onChange }: { cron: string; onChange: (c: string) => void }) {
  const [s, setS] = useState<ScheduleState>(() => parseCron(cron));

  // Sync incoming cron (e.g. loaded from DB) once on mount
  useEffect(() => {
    setS(parseCron(cron));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<ScheduleState>) => {
    const next = { ...s, ...patch };
    setS(next);
    onChange(buildCron(next));
  };

  const toggleWeekDay = (d: number) => {
    const next = s.weekDays.includes(d) ? s.weekDays.filter((x) => x !== d) : [...s.weekDays, d];
    update({ weekDays: next.length ? next : [d] });
  };

  const freq = s.frequency;

  return (
    <div className="space-y-3">
      {/* Frequency pills */}
      <div>
        <label className="text-xs font-medium text-text-secondary mb-1 block">Repeat</label>
        <div className="flex flex-wrap gap-1.5">
          {(['none', 'daily', 'weekly', 'monthly'] as Frequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => update({ frequency: f })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${freq === f ? 'bg-accent text-white border-accent' : 'bg-bg-primary border-border-color text-text-secondary hover:border-accent hover:text-text-primary'}`}
            >
              {f === 'none' ? 'No schedule' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {freq !== 'none' && (
        <>
          {/* Time picker */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Time</label>
            <div className="flex items-center gap-2">
              <select
                value={s.hour}
                onChange={(e) => update({ hour: Number(e.target.value) })}
                className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
              >
                {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
              </select>
              <span className="text-text-secondary text-sm">:</span>
              <select
                value={s.minute}
                onChange={(e) => update({ minute: e.target.value })}
                className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
              >
                {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex rounded-lg border border-border-color overflow-hidden">
                {(['AM', 'PM'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => update({ ampm: a })}
                    className={`px-3 py-1.5 text-xs font-medium transition-all ${s.ampm === a ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly: day of week */}
          {freq === 'weekly' && (
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Days of week</label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekDay(i)}
                    className={`w-9 h-9 rounded-full text-xs font-medium border transition-all ${s.weekDays.includes(i) ? 'bg-accent text-white border-accent' : 'bg-bg-primary border-border-color text-text-secondary hover:border-accent hover:text-text-primary'}`}
                  >
                    {day.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: day of month */}
          {freq === 'monthly' && (
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">Day of month</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={s.monthDay}
                  onChange={(e) => update({ monthDay: Math.min(31, Math.max(1, Number(e.target.value))) })}
                  className="w-20 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                />
                <span className="text-xs text-text-secondary">of every month</span>
              </div>
            </div>
          )}

          {/* Human-readable summary */}
          <div className="flex items-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-2">
            <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span className="text-xs text-text-primary font-medium">{humanCron(s)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trigger Editor ──────────────────────────────────────────

const BASE_EVENTS: Array<{ event: string; label: string; group: string }> = [
  { event: 'conversation.turn_completed', label: 'Conversation turn completed', group: 'Conversation' },
  { event: 'lead.created', label: 'New lead created', group: 'Lead' },
  { event: 'lead.assigned', label: 'Lead assigned', group: 'Lead' },
  { event: 'lead.pipeline_stage_changed', label: 'Lead pipeline stage changed', group: 'Lead' },
  { event: 'work.created', label: 'Task created', group: 'Work' },
  { event: 'work.completed', label: 'Task completed', group: 'Work' },
];

function TriggerEditor({
  triggers,
  scheduleCron,
  dynamicTriggers,
  onTriggersChange,
  onCronChange,
}: {
  triggers: TriggerConfig[];
  scheduleCron: string;
  dynamicTriggers: DynamicTrigger[];
  onTriggersChange: (t: TriggerConfig[]) => void;
  onCronChange: (c: string) => void;
}) {
  // Group: base events + datasheet events
  const datasheetEvents = dynamicTriggers.map((dt) => ({
    event: dt.event,
    label: dt.label,
    group: 'Datasheet',
  }));

  const allEvents = [...BASE_EVENTS, ...datasheetEvents];
  const groups = Array.from(new Set(allEvents.map((e) => e.group)));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-text-secondary">Event triggers</label>
        {groups.map((group) => (
          <div key={group} className="mt-2">
            <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">{group}</div>
            <div className="flex flex-wrap gap-1.5">
              {allEvents.filter((e) => e.group === group).map(({ event: evt, label }) => {
                const on = triggers.some((t) => t.event === evt);
                return (
                  <button
                    key={evt}
                    type="button"
                    onClick={() => on
                      ? onTriggersChange(triggers.filter((t) => t.event !== evt))
                      : onTriggersChange([...triggers, { type: 'event' as const, event: evt }])}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${on ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'}`}
                    title={evt}
                  >
                    <Zap className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary mb-2 block">Schedule</label>
        <ScheduleBuilder cron={scheduleCron} onChange={onCronChange} />
      </div>
    </div>
  );
}

// ─── Run Status Badge ────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; Icon: typeof CheckCircle }> = {
    success: { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: CheckCircle },
    partial: { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', Icon: AlertTriangle },
    failed: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', Icon: XCircle },
    skipped: { bg: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400', Icon: Pause },
    running: { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', Icon: Activity },
  };
  const { bg, Icon } = map[status] ?? map.skipped;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${bg}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
}

// ─── Run Row ─────────────────────────────────────────────────

function RunRow({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border-color bg-card-bg">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-bg-secondary/50">
        <div className="flex items-center gap-2 min-w-0">
          <RunStatusBadge status={run.status} />
          <span className="text-xs text-text-secondary truncate">{run.trigger_event || 'manual'}</span>
          <span className="text-xs text-text-secondary">{run.actions_taken?.length ?? 0} actions</span>
          {run.cost_usd > 0 && (
            <span className="text-[10px] text-text-secondary flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{run.cost_usd.toFixed(4)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary">{run.created_at ? formatDateTime(run.created_at) : ''}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-border-color text-xs space-y-2">
          {run.reasoning && (
            <div className="mt-2">
              <span className="font-medium text-text-primary flex items-center gap-1 mb-1"><Brain className="w-3 h-3" /> Reasoning</span>
              <p className="text-text-secondary bg-bg-secondary rounded-lg p-2 whitespace-pre-wrap">{run.reasoning}</p>
            </div>
          )}
          {run.actions_taken && run.actions_taken.length > 0 && (
            <div>
              <span className="font-medium text-text-primary">Actions:</span>
              <div className="mt-1 space-y-1">
                {run.actions_taken.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between p-1.5 rounded-md ${a.success ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <span>{a.success ? '✅' : '❌'} {a.skill.replace(/_/g, ' ')}</span>
                    <span className="text-text-secondary">{a.execution_time_ms.toFixed(0)}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {run.error && <div className="text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-lg p-2">Error: {run.error}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main Automation Tab ─────────────────────────────────────

export default function AutomationPage() {
  const { current, update } = useAgentStore();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicTriggers, setDynamicTriggers] = useState<DynamicTrigger[]>([]);

  // Local form state
  const [automationInstructions, setAutomationInstructions] = useState('');
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [scheduleCron, setScheduleCron] = useState('');
  const [maxActions, setMaxActions] = useState(10);

  useEffect(() => {
    // Load dynamic triggers (datasheet events)
    listAvailableSkillsAndTriggers().then((res) => {
      setDynamicTriggers(res.dynamic_triggers ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (current) {
      const rawAutoInst = (current.settings as { automation_instructions?: unknown } | null | undefined)?.automation_instructions;
      setAutomationInstructions(typeof rawAutoInst === 'string' ? rawAutoInst : '');
      setTriggers(current.triggers ?? []);
      setScheduleCron(current.scheduleCron ?? '');
      setMaxActions(current.maxActionsPerRun ?? 10);
      loadRuns();
    }
  }, [current?.id]);

  const loadRuns = useCallback(async () => {
    if (!current) return;
    setRunsLoading(true);
    try {
      const data = await listAgentRuns(String(current.id), 30);
      setRuns(data);
    } catch { /* ignore */ } finally { setRunsLoading(false); }
  }, [current?.id]);

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      // Merge automation_instructions into the existing settings JSON
      const mergedSettings: Record<string, unknown> = {
        ...(current.settings || {}),
        automation_instructions: automationInstructions,
      };
      await update(String(current.id), {
        triggers,
        scheduleCron: scheduleCron || null,
        maxActionsPerRun: maxActions,
        settings: mergedSettings,
      });
    } catch { /* error handled by store */ } finally { setSaving(false); }
  }, [current, automationInstructions, triggers, scheduleCron, maxActions, update]);

  const handleTestRun = useCallback(async () => {
    if (!current) return;
    setRunningManual(true);
    try {
      await runAgentManually(String(current.id));
      await loadRuns();
    } catch { /* ignore */ } finally { setRunningManual(false); }
  }, [current?.id, loadRuns]);

  if (!current) return null;

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Automation</h2>
          <p className="text-xs text-text-secondary mt-0.5">Skills, triggers, and scheduling for background operations</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleTestRun}
            disabled={runningManual}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
          >
            {runningManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Test Run
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Automation Instructions */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <label className="text-xs font-semibold text-text-primary">Automation instructions</label>
            <p className="text-[10px] text-text-secondary mb-2">
              What should the agent do when triggered automatically? Used for event triggers
              and scheduled runs (not for customer chat — that uses the chat instructions in the Overview tab).
            </p>
            <textarea
              value={automationInstructions}
              onChange={(e) => setAutomationInstructions(e.target.value)}
              rows={8}
              placeholder={`Example:\n\nFind leads in "new" status older than 3 days.\nFor each one, send them a re-engagement message using send_message,\nand add a note with add_lead_note summarizing the outreach.`}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono"
            />
            <p className="mt-1 text-[11px] text-text-secondary">
              The agent uses the <strong>same skill list</strong> as chat — configure it in the{' '}
              <Link href={`/agents/${current.id}/skills`} className="inline-flex items-center gap-0.5 text-accent hover:underline">
                <Puzzle className="w-3 h-3" /> Skills
              </Link>{' '}tab.
            </p>
          </div>

          {/* Triggers */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <label className="text-xs font-semibold text-text-primary">Triggers</label>
            <p className="text-[10px] text-text-secondary mb-2">When should this agent run? Pick events and/or set a schedule.</p>
            <TriggerEditor triggers={triggers} scheduleCron={scheduleCron} dynamicTriggers={dynamicTriggers} onTriggersChange={setTriggers} onCronChange={setScheduleCron} />
          </div>

          {/* Max actions */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <label className="text-xs font-semibold text-text-primary">Max actions per run</label>
            <p className="text-[10px] text-text-secondary mb-2">
              Safety limit — the agent can call at most this many skills in one run.
            </p>
            <input
              type="number"
              min={1}
              max={20}
              value={maxActions}
              onChange={(e) => setMaxActions(Number(e.target.value))}
              className="w-24 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
        </div>

        {/* Right: Run History */}
        <div>
          <div className="rounded-xl border border-border-color bg-card-bg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Activity className="w-4 h-4" /> Recent Runs</h3>
              <button type="button" onClick={loadRuns} className="text-xs text-accent hover:underline">Refresh</button>
            </div>
            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {runsLoading ? (
                <p className="text-center text-xs text-text-secondary py-6">Loading...</p>
              ) : runs.length === 0 ? (
                <p className="text-center text-xs text-text-secondary py-8">No runs yet. Click "Test Run" to try.</p>
              ) : (
                runs.map((run) => <RunRow key={run.id} run={run} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
