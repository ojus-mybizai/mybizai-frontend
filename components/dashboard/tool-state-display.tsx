'use client';

export interface ToolState {
  tool: string;
  status: 'running' | 'done' | 'error';
  label: string;
  input: Record<string, unknown>;
  output: unknown;
}

interface ToolStateDisplayProps {
  toolStates: ToolState[];
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

/** Friendly display name for known tool IDs */
const TOOL_LABEL: Record<string, string> = {
  dynamic_db_search:    'DB Search',
  query_datasheet:      'Datasheet',
  create_record:        'Create Record',
  update_record:        'Update Record',
  delete_record:        'Delete Record',
  list_records:         'List Records',
  get_record:           'Get Record',
  create_lead:          'Create Lead',
  update_lead:          'Update Lead',
  get_lead:             'Get Lead',
  list_leads:           'List Leads',
  create_task:          'Create Task',
  update_task:          'Update Task',
  list_tasks:           'List Tasks',
  send_message:         'Send Message',
  get_analytics:        'Analytics',
  web_search:           'Web Search',
};

function friendlyToolName(raw: string): string {
  if (TOOL_LABEL[raw]) return TOOL_LABEL[raw];
  // Convert snake_case → Title Case as fallback
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const TOOL_COLOR: Record<string, string> = {
  dynamic_db_search: 'bg-blue-500/10 text-blue-600',
  query_datasheet:   'bg-violet-500/10 text-violet-600',
  create_record:     'bg-green-500/10 text-green-600',
  update_record:     'bg-amber-500/10 text-amber-600',
  delete_record:     'bg-red-500/10 text-red-600',
  create_lead:       'bg-cyan-500/10 text-cyan-600',
  send_message:      'bg-indigo-500/10 text-indigo-600',
};

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
    return (
      <span className="text-xs text-text-secondary">{output.length} item(s) returned</span>
    );
  }
  return <span className="text-xs text-text-secondary">{formatValue(output)}</span>;
}

export default function ToolStateDisplay({ toolStates }: ToolStateDisplayProps) {
  if (!toolStates || toolStates.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {toolStates.map((ts, i) => (
        <div
          key={i}
          className="flex flex-col rounded-lg border border-border-color bg-bg-secondary/60 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {STATUS_ICON[ts.status] ?? STATUS_ICON.running}
            <span className="text-xs font-medium text-text-primary">{ts.label}</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${
                TOOL_COLOR[ts.tool] ?? 'bg-bg-secondary text-text-secondary'
              }`}
            >
              {friendlyToolName(ts.tool)}
            </span>
          </div>

          {/* Input context */}
          {ts.input && Object.keys(ts.input).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3">
              {Object.entries(ts.input)
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
          {ts.status === 'done' && ts.output !== null && ts.output !== undefined && (
            <OutputSummary output={ts.output} />
          )}
        </div>
      ))}
    </div>
  );
}
