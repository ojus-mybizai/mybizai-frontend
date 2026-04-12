'use client';

/**
 * SkillStateDisplay — shows the step-by-step actions an agent (or the
 * AI Manager dashboard) took while answering a query.
 *
 * The backend's AI Manager dashboard returns these under `tool_states` with
 * a `tool` field for historical reasons. That shape is preserved here so the
 * component drops in where the old `ToolStateDisplay` lived.
 */
export interface SkillState {
  /** Name of the skill or backend action (e.g. "send_message", "query_datasheet") */
  tool: string;
  status: 'running' | 'done' | 'error';
  label: string;
  input: Record<string, unknown>;
  output: unknown;
}

interface SkillStateDisplayProps {
  /** Uses `toolStates` prop name for backward compatibility with existing callers */
  toolStates: SkillState[];
}

const STATUS_ICON = {
  running: (
    <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  ),
  done: (
    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

/** Friendly display name for known skills / dashboard actions. */
const SKILL_LABEL: Record<string, string> = {
  // Chat agent skills (post V1→BrainEngine migration)
  send_message:            'Send Reply',
  send_template_message:   'Template Reply',
  qualify_lead:            'Qualify Lead',
  score_lead:              'Score Lead',
  assign_lead:             'Assign Lead',
  update_lead_field:       'Update Lead',
  add_lead_note:           'Add Note',
  query_leads:             'Query Leads',
  get_lead_details:        'Lead Details',
  switch_lead_agent:       'Switch Agent',
  create_work:             'Create Task',
  assign_work:             'Assign Task',
  reassign_work:           'Reassign Task',
  query_work:              'Query Tasks',
  get_overdue_work:        'Overdue Tasks',
  move_to_stage:           'Move Stage',
  get_pipeline_status:     'Pipeline Status',
  notify_user:             'Notify User',
  lookup_knowledge:        'Lookup Knowledge',

  // AI Manager dashboard actions (legacy MCP actions)
  query_datasheet:         'Datasheet',
  dynamic_db_search:       'DB Search',
  create_record:           'Create Record',
  update_record:           'Update Record',
  delete_record:           'Delete Record',
  list_records:            'List Records',
  get_record:              'Get Record',
  create_lead:             'Create Lead',
  update_lead:             'Update Lead',
  get_lead:                'Get Lead',
  list_leads:              'List Leads',
  create_task:             'Create Task',
  update_task:             'Update Task',
  list_tasks:              'List Tasks',
  get_analytics:           'Analytics',
  web_search:              'Web Search',
};

function friendlySkillName(raw: string): string {
  if (SKILL_LABEL[raw]) return SKILL_LABEL[raw];
  // Dynamic datasheet skills: search_{name} / create_{name}_record / update_{name}_record
  if (raw.startsWith('search_')) return `Search ${raw.replace(/^search_/, '').replace(/_/g, ' ')}`;
  if (raw.startsWith('create_') && raw.endsWith('_record'))
    return `Create ${raw.replace(/^create_/, '').replace(/_record$/, '').replace(/_/g, ' ')}`;
  if (raw.startsWith('update_') && raw.endsWith('_record'))
    return `Update ${raw.replace(/^update_/, '').replace(/_record$/, '').replace(/_/g, ' ')}`;
  // Fallback: snake_case → Title Case
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const SKILL_COLOR: Record<string, string> = {
  send_message:          'bg-indigo-500/10 text-indigo-600',
  send_template_message: 'bg-indigo-500/10 text-indigo-600',
  qualify_lead:          'bg-emerald-500/10 text-emerald-600',
  score_lead:            'bg-emerald-500/10 text-emerald-600',
  assign_lead:           'bg-cyan-500/10 text-cyan-600',
  update_lead_field:     'bg-amber-500/10 text-amber-600',
  add_lead_note:         'bg-yellow-500/10 text-yellow-600',
  query_leads:           'bg-blue-500/10 text-blue-600',
  create_work:           'bg-green-500/10 text-green-600',
  assign_work:           'bg-green-500/10 text-green-600',
  query_work:            'bg-blue-500/10 text-blue-600',
  move_to_stage:         'bg-violet-500/10 text-violet-600',
  notify_user:           'bg-pink-500/10 text-pink-600',
  lookup_knowledge:      'bg-purple-500/10 text-purple-600',
  // Legacy dashboard actions
  query_datasheet:       'bg-violet-500/10 text-violet-600',
  dynamic_db_search:     'bg-blue-500/10 text-blue-600',
  create_record:         'bg-green-500/10 text-green-600',
  update_record:         'bg-amber-500/10 text-amber-600',
  delete_record:         'bg-red-500/10 text-red-600',
  create_lead:           'bg-cyan-500/10 text-cyan-600',
};

function skillColorClass(skill: string): string {
  if (SKILL_COLOR[skill]) return SKILL_COLOR[skill];
  if (skill.startsWith('search_')) return 'bg-blue-500/10 text-blue-600';
  if (skill.startsWith('create_') && skill.endsWith('_record')) return 'bg-green-500/10 text-green-600';
  if (skill.startsWith('update_') && skill.endsWith('_record')) return 'bg-amber-500/10 text-amber-600';
  return 'bg-bg-secondary text-text-secondary';
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function OutputSummary({ output }: { output: unknown }) {
  if (output === null || output === undefined) return null;
  if (typeof output === 'object' && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    const entries = Object.entries(obj).slice(0, 4);
    return (
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.map(([k, v]) => (
          <span key={k} className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">{k}:</span> {formatValue(v)}
          </span>
        ))}
      </div>
    );
  }
  if (Array.isArray(output)) {
    return <span className="text-xs text-text-secondary">{output.length} item(s) returned</span>;
  }
  return <span className="text-xs text-text-secondary">{formatValue(output)}</span>;
}

export default function SkillStateDisplay({ toolStates }: SkillStateDisplayProps) {
  if (!toolStates || toolStates.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {toolStates.map((s, i) => (
        <div
          key={i}
          className="flex flex-col rounded-lg border border-border-color bg-bg-secondary/60 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {STATUS_ICON[s.status] ?? STATUS_ICON.running}
            <span className="text-xs font-medium text-text-primary">{s.label}</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${skillColorClass(s.tool)}`}
            >
              {friendlySkillName(s.tool)}
            </span>
          </div>

          {/* Input context */}
          {s.input && Object.keys(s.input).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3">
              {Object.entries(s.input)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .slice(0, 3)
                .map(([k, v]) => (
                  <span key={k} className="text-xs text-text-secondary">
                    <span className="italic">{k}:</span> {formatValue(v)}
                  </span>
                ))}
            </div>
          )}

          {/* Output summary (only when done) */}
          {s.status === 'done' && s.output !== null && s.output !== undefined && (
            <OutputSummary output={s.output} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Legacy alias — prefer SkillState going forward */
export type ToolState = SkillState;
