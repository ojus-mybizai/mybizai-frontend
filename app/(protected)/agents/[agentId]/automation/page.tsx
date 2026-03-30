'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import {
  listAgentRuns,
  runAgentManually,
  listAvailableSkillsAndTriggers,
  type AgentRun,
  type SkillDefinition,
  type TriggerConfig,
  type DynamicTrigger,
} from '@/services/agents';
import {
  Play,
  Clock,
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
} from 'lucide-react';

// ─── Skill Picker ────────────────────────────────────────────

function SkillPicker({
  allSkills,
  selected,
  onChange,
}: {
  allSkills: SkillDefinition[];
  selected: string[];
  onChange: (skills: string[]) => void;
}) {
  const categories = Array.from(new Set(allSkills.map((s) => s.category)));
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">{cat}</h4>
          <div className="flex flex-wrap gap-1.5">
            {allSkills.filter((s) => s.category === cat).map((skill) => {
              const on = selected.includes(skill.name);
              return (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => onChange(on ? selected.filter((s) => s !== skill.name) : [...selected, skill.name])}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${on ? 'bg-accent/10 border-accent text-accent' : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'}`}
                  title={skill.description}
                >
                  {skill.is_llm_based && '🧠 '}{skill.name.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Trigger Editor ──────────────────────────────────────────

const BASE_EVENTS: Array<{ event: string; label: string; group: string }> = [
  { event: 'conversation.turn_completed', label: 'Conversation turn completed', group: 'Conversation' },
  { event: 'lead.created', label: 'New lead created', group: 'Lead' },
  { event: 'lead.assigned', label: 'Lead assigned', group: 'Lead' },
  { event: 'lead.status_changed', label: 'Lead status changed', group: 'Lead' },
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
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${on ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-bg-primary border-border-color text-text-secondary hover:border-text-secondary'}`}
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
        <label className="text-xs font-medium text-text-secondary">Schedule (cron)</label>
        <input
          type="text"
          value={scheduleCron}
          onChange={(e) => onCronChange(e.target.value)}
          placeholder="e.g. 0 9 * * * (daily at 9am)"
          className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
        />
        <p className="text-[10px] text-text-secondary mt-0.5">5-field cron: minute hour day month weekday. Leave empty for event-only.</p>
      </div>
    </div>
  );
}

// ─── Run Status Badge ────────────────────────────────────────

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; Icon: typeof CheckCircle }> = {
    success: { bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: CheckCircle },
    partial: { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: AlertTriangle },
    failed: { bg: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: XCircle },
    skipped: { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', Icon: Pause },
    running: { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', Icon: Activity },
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
          <span className="text-[10px] text-text-secondary">{run.created_at ? new Date(run.created_at).toLocaleString() : ''}</span>
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
  const { current, skills, loadSkills, update } = useAgentStore();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dynamicTriggers, setDynamicTriggers] = useState<DynamicTrigger[]>([]);

  // Local form state
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<TriggerConfig[]>([]);
  const [scheduleCron, setScheduleCron] = useState('');
  const [maxActions, setMaxActions] = useState(10);

  useEffect(() => {
    // Load skills + dynamic triggers together
    listAvailableSkillsAndTriggers().then((res) => {
      // Skills are loaded into the store via loadSkills, but we also need dynamic triggers
      setDynamicTriggers(res.dynamic_triggers ?? []);
    }).catch(() => {});
    loadSkills();
  }, []);

  useEffect(() => {
    if (current) {
      setSelectedSkills(current.skills ?? []);
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
      await update(String(current.id), {
        skills: selectedSkills,
        triggers,
        scheduleCron: scheduleCron || null,
        maxActionsPerRun: maxActions,
      });
    } catch { /* error handled by store */ } finally { setSaving(false); }
  }, [current?.id, selectedSkills, triggers, scheduleCron, maxActions, update]);

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
          {/* Skills */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <label className="text-xs font-semibold text-text-primary">Skills ({selectedSkills.length} selected)</label>
            <p className="text-[10px] text-text-secondary mb-2">Choose what actions this agent can take when triggered.</p>
            <SkillPicker allSkills={skills} selected={selectedSkills} onChange={setSelectedSkills} />
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
            <input
              type="number"
              min={1}
              max={20}
              value={maxActions}
              onChange={(e) => setMaxActions(Number(e.target.value))}
              className="mt-1 w-24 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
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
