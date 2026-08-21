import { apiFetch } from '@/lib/api-client';
import type { WaWorkItem } from '@/services/waWork';

// ---------- Types ----------

/** Discriminator selecting the runtime path for a stage-bound task.
 *  - 'wa_work'       → WhatsApp dispatch to Members (new default).
 *  - 'internal_work' → legacy Work row pointed at a platform User. Kept so
 *                      pre-migration rows still render (read-only chip) and
 *                      keep firing until the owner removes them. */
export type StageWorkDispatchKind = 'wa_work' | 'internal_work';

/** How a WA task picks recipient(s) from its pool (group members / employees):
 *  all = everyone · random = one at random · round_robin = rotate through the
 *  group · least_loaded = fewest open task assignments. */
export type WaAssignmentStrategy = 'all' | 'random' | 'round_robin' | 'least_loaded';

export interface ProcessStageWork {
  id: number;
  stage_id: number;
  dispatch_kind: StageWorkDispatchKind;

  // ── internal_work (legacy) ───────────────────────────────────────────
  work_template_id: number | null;
  work_template_name: string | null;
  default_assigned_to_id: number | null;
  default_assigned_to_name: string | null;

  // ── wa_work ──────────────────────────────────────────────────────────
  wa_template_id: number | null;
  wa_template_name: string | null;
  /** simple_task | whatsapp_form | checklist | (lead_list — blocked) */
  wa_template_type: string | null;
  wa_assigned_employee_ids: number[] | null;
  wa_assigned_employee_names: string[] | null;
  /** Slice 3c — the role dispatch pool (owner|manager|sales|support|caller|staff). */
  wa_assigned_role: string | null;
  wa_dispatch_mode: 'individual' | 'broadcast' | null;
  wa_auto_dispatch: boolean;
  wa_assignment_strategy: WaAssignmentStrategy | null;

  // ── shared ───────────────────────────────────────────────────────────
  title: string | null;
  description: string | null;
  sort_order: number;
  due_in_days: number | null;
}

export interface ProcessStage {
  id: number;
  process_id: number;
  name: string;
  color: string | null;
  stage_type: 'active' | 'completed' | 'failed';
  sort_order: number;
  auto_advance_on_complete: boolean;
  // Operational settings
  sla_days: number | null;
  warn_days: number | null;
  wip_limit: number | null;
  win_probability: number | null;
  required_fields: string[] | null;
  entry_count: number;
  stage_works: ProcessStageWork[];
}

export interface BusinessProcess {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  entity_type: 'lead' | 'datasheet_record' | 'contact';
  dynamic_model_id: number | null;
  dynamic_model_name: string | null;
  status: string;
  color: string | null;
  total_entries: number;
  active_entries: number;
  stages: ProcessStage[];
  created_at?: string;
  updated_at?: string;
}

export interface BusinessProcessListItem {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  entity_type: string;
  dynamic_model_name: string | null;
  status: string;
  color: string | null;
  stage_count: number;
  total_entries: number;
  active_entries: number;
  open_value?: number;
  weighted_value?: number;
  stuck_count?: number;
  created_at?: string;
}

export type EntryPriority = 'low' | 'medium' | 'high';
export type SlaStatus = 'ok' | 'warn' | 'breach' | null;

export interface ProcessEntry {
  id: number;
  process_id: number;
  current_stage_id: number | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  entity_type: string;
  entity_id: number;
  entity_name: string | null;
  entity_phone: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_member_id: number | null;
  assigned_member_name: string | null;
  status: string;
  entered_at?: string;
  stage_entered_at?: string;
  completed_at?: string;
  notes: string | null;
  created_at?: string;
  // Deal-level fields (newly exposed)
  title: string | null;
  priority: EntryPriority | null;
  expected_value: number | null;
  expected_close_date: string | null;  // ISO date
  source: string | null;
  // Derived
  days_in_stage: number | null;
  sla_status: SlaStatus;
}

export interface ProcessEntryWithProcess extends ProcessEntry {
  process_name: string;
  process_color: string | null;
  process_stages: Array<{
    id: number;
    name: string;
    color: string | null;
    stage_type: 'active' | 'completed' | 'failed';
    sort_order: number;
  }>;
}

// ---------- Process CRUD ----------

export async function listProcesses(status?: string): Promise<BusinessProcessListItem[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<BusinessProcessListItem[]>(`/processes${qs}`, { method: 'GET', auth: true });
}

export async function getProcess(processId: number): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/${processId}`, { method: 'GET', auth: true });
}

export async function createProcess(payload: {
  name: string;
  description?: string;
  entity_type: string;
  dynamic_model_id?: number | null;
  color?: string;
  stages?: Array<{
    name: string;
    color?: string;
    stage_type?: string;
    sort_order?: number;
    stage_works?: Array<{
      work_template_id?: number | null;
      title?: string;
      description?: string;
      default_assigned_to_id?: number | null;
      sort_order?: number;
    }>;
  }>;
}): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>('/processes', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateProcess(processId: number, payload: {
  name?: string; description?: string; status?: string; color?: string;
}): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/${processId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteProcess(processId: number): Promise<void> {
  await apiFetch(`/processes/${processId}`, { method: 'DELETE', auth: true });
}

// ---------- Stage CRUD ----------

export async function addStage(processId: number, payload: {
  name: string; color?: string; stage_type?: string; sort_order?: number;
  auto_advance_on_complete?: boolean;
  sla_days?: number | null; warn_days?: number | null;
  wip_limit?: number | null; win_probability?: number | null;
  required_fields?: string[] | null;
  stage_works?: Array<{ work_template_id?: number | null; title?: string; default_assigned_to_id?: number | null; due_in_days?: number | null }>;
}): Promise<ProcessStage> {
  return apiFetch<ProcessStage>(`/processes/${processId}/stages`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateStage(processId: number, stageId: number, payload: {
  name?: string; color?: string; stage_type?: string; sort_order?: number;
  auto_advance_on_complete?: boolean;
  sla_days?: number | null; warn_days?: number | null;
  wip_limit?: number | null; win_probability?: number | null;
  required_fields?: string[] | null;
}): Promise<ProcessStage> {
  return apiFetch<ProcessStage>(`/processes/${processId}/stages/${stageId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteStage(processId: number, stageId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/${stageId}`, { method: 'DELETE', auth: true });
}

// ---------- Stage Works ----------

export interface AddStageWorkPayload {
  /** Defaults server-side to 'wa_work' if omitted — the UI sends it explicitly. */
  dispatch_kind?: StageWorkDispatchKind;

  // Internal-work (legacy — not produced by the rebuilt UI, kept for API parity).
  work_template_id?: number | null;
  default_assigned_to_id?: number | null;

  // WA-work
  wa_template_id?: number | null;
  wa_assigned_employee_ids?: number[] | null;
  wa_assigned_role?: string | null;             // Slice 3c — role dispatch pool
  wa_dispatch_mode?: 'individual' | 'broadcast';
  wa_auto_dispatch?: boolean;
  wa_assignment_strategy?: WaAssignmentStrategy;

  // Shared
  title?: string;
  description?: string;
  sort_order?: number;
  due_in_days?: number | null;
}

export async function addStageWork(
  processId: number, stageId: number, payload: AddStageWorkPayload,
): Promise<ProcessStageWork> {
  return apiFetch<ProcessStageWork>(`/processes/${processId}/stages/${stageId}/works`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteStageWork(processId: number, stageId: number, workId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/${stageId}/works/${workId}`, { method: 'DELETE', auth: true });
}

/** List the WaWorkItems (with embedded assignments) that were auto-spawned
 *  for this process entry. Powers the entry drawer's WhatsApp tasks panel. */
export async function listEntryWaWork(
  processId: number, entryId: number,
): Promise<WaWorkItem[]> {
  return apiFetch<WaWorkItem[]>(
    `/processes/${processId}/entries/${entryId}/wa-work`,
    { method: 'GET', auth: true },
  );
}

// ---------- Process Entries ----------

export async function listEntries(processId: number, params?: {
  stage_id?: number; status?: string;
}): Promise<ProcessEntry[]> {
  const qs = new URLSearchParams();
  if (params?.stage_id) qs.set('stage_id', String(params.stage_id));
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<ProcessEntry[]>(`/processes/${processId}/entries${q ? `?${q}` : ''}`, { method: 'GET', auth: true });
}

export async function addEntry(processId: number, payload: {
  entity_id: number; entity_name?: string; entity_phone?: string;
  stage_id?: number; assigned_to_id?: number; notes?: string;
  title?: string; priority?: EntryPriority;
  expected_value?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
}): Promise<ProcessEntry> {
  return apiFetch<ProcessEntry>(`/processes/${processId}/entries`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function moveEntry(processId: number, entryId: number, stageId: number): Promise<ProcessEntry> {
  return apiFetch<ProcessEntry>(`/processes/${processId}/entries/${entryId}/move`, {
    method: 'PUT', auth: true,
    body: JSON.stringify({ stage_id: stageId }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function removeEntry(processId: number, entryId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/entries/${entryId}`, { method: 'DELETE', auth: true });
}

export async function updateEntry(entryId: number, payload: {
  notes?: string | null;
  assigned_to_id?: number | null;
  assigned_member_id?: number | null;
  status?: 'active' | 'completed' | 'dropped';
  title?: string | null;
  priority?: EntryPriority | null;
  expected_value?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
}): Promise<ProcessEntry> {
  return apiFetch<ProcessEntry>(`/processes/entries/${entryId}`, {
    method: 'PATCH', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Bulk Operations ----------

export interface BulkMoveResult {
  updated: number;
  skipped?: number;
  skipped_details?: Array<{ entry_id: number; reason: string }>;
}

export async function bulkMoveEntries(processId: number, entry_ids: number[], stage_id: number): Promise<BulkMoveResult> {
  return apiFetch(`/processes/${processId}/entries/bulk-move`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ entry_ids, stage_id }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function bulkAssignEntries(
  processId: number,
  entry_ids: number[],
  assignee: { assigned_member_id: number | null } | { assigned_to_id: number | null },
): Promise<{ updated: number }> {
  return apiFetch(`/processes/${processId}/entries/bulk-assign`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ entry_ids, ...assignee }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function bulkUpdateEntries(processId: number, entry_ids: number[], patch: { priority?: EntryPriority; status?: 'active' | 'completed' | 'dropped' }): Promise<{ updated: number }> {
  return apiFetch(`/processes/${processId}/entries/bulk-update`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ entry_ids, ...patch }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Reorder ----------

export async function reorderStages(processId: number, stage_ids: number[]): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/reorder`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ stage_ids }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function reorderStageWorks(processId: number, stageId: number, work_ids: number[]): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/${stageId}/works/reorder`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ work_ids }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Clone ----------

export async function cloneProcess(processId: number, name_override?: string): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/${processId}/clone`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ name_override }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Analytics ----------

export interface ProcessMetrics {
  period_days: number;
  total_active: number;
  total_value: number;
  weighted_value: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  avg_cycle_days: number | null;
  by_stage: Array<{
    stage_id: number; stage_name: string; stage_color: string | null;
    stage_type: string; count: number; sum_value: number; weighted_value: number;
    avg_days_in_stage: number; win_probability: number | null;
  }>;
  funnel: Array<{
    from_stage_id: number; from_stage_name: string;
    to_stage_id: number; to_stage_name: string;
    moved_count: number; conversion_rate: number;
  }>;
}

export async function getProcessMetrics(processId: number, period_days = 30): Promise<ProcessMetrics> {
  return apiFetch<ProcessMetrics>(`/processes/${processId}/metrics?period_days=${period_days}`, { method: 'GET', auth: true });
}

export interface ForecastBucket {
  label: string;
  raw_value: number;
  weighted_value: number;
  count: number;
  entry_ids: number[];
}

export interface Forecast {
  raw_total: number;
  weighted_total: number;
  buckets: ForecastBucket[];
}

export async function getProcessForecast(processId: number): Promise<Forecast> {
  return apiFetch<Forecast>(`/processes/${processId}/forecast`, { method: 'GET', auth: true });
}

export interface VelocityPoint { date: string; added: number; completed: number; dropped: number; }
export interface Velocity { period_days: number; series: VelocityPoint[]; }

export async function getProcessVelocity(processId: number, period_days = 30): Promise<Velocity> {
  return apiFetch<Velocity>(`/processes/${processId}/velocity?period_days=${period_days}`, { method: 'GET', auth: true });
}

export interface StuckEntryItem { entry: ProcessEntry; days_in_stage: number; sla_days: number | null; sla_status: 'warn' | 'breach'; }
export interface Stuck { threshold_days: number; entries: StuckEntryItem[]; }

export async function getProcessStuck(processId: number, days = 7): Promise<Stuck> {
  return apiFetch<Stuck>(`/processes/${processId}/stuck?days=${days}`, { method: 'GET', auth: true });
}

export interface LeaderboardRow { user_id: number; user_name: string | null; active: number; won: number; lost: number; win_rate: number; revenue: number; }
export interface Leaderboard { period_days: number; rows: LeaderboardRow[]; }

export async function getProcessLeaderboard(processId: number, period_days = 30): Promise<Leaderboard> {
  return apiFetch<Leaderboard>(`/processes/${processId}/leaderboard?period_days=${period_days}`, { method: 'GET', auth: true });
}

export interface ActivityEvent {
  id: number; type: string; description: string;
  actor_id: number | null; actor_name: string | null;
  entity_type: string | null; entity_id: number | null; entity_name: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Activity { events: ActivityEvent[]; has_more: boolean; }

export async function getProcessActivity(processId: number, limit = 50, offset = 0): Promise<Activity> {
  return apiFetch<Activity>(`/processes/${processId}/activity?limit=${limit}&offset=${offset}`, { method: 'GET', auth: true });
}

export interface ProcessDashboard {
  open_value: number;
  weighted_value: number;
  closing_this_week_value: number;
  win_rate_30d: number;
  stuck_count: number;
  added_today: number;
  completed_today: number;
  per_process: BusinessProcessListItem[];
}

export async function getProcessDashboard(): Promise<ProcessDashboard> {
  return apiFetch<ProcessDashboard>(`/processes/dashboard`, { method: 'GET', auth: true });
}

// ---------- Comments ----------

export interface EntryComment {
  id: number;
  entry_id: number;
  user_id: number | null;
  user_name: string | null;
  body: string;
  created_at: string;
}

export async function listEntryComments(entryId: number): Promise<EntryComment[]> {
  return apiFetch<EntryComment[]>(`/processes/entries/${entryId}/comments`, { method: 'GET', auth: true });
}

export async function addEntryComment(entryId: number, body: string): Promise<EntryComment> {
  return apiFetch<EntryComment>(`/processes/entries/${entryId}/comments`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ body }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteEntryComment(entryId: number, commentId: number): Promise<void> {
  await apiFetch(`/processes/entries/${entryId}/comments/${commentId}`, { method: 'DELETE', auth: true });
}

// ---------- Required-field options ----------

export interface ProcessFieldOption { key: string; label: string; }
/** A {{token}} that is valid to insert into a WhatsApp task message body for
 *  this pipeline (entity-aware — only tokens that will actually fill). */
export interface ProcessMessageToken { token: string; label: string; group: string; }
export interface ProcessFieldOptions {
  entity_type: string;
  entity_label: string;
  deal_fields: ProcessFieldOption[];
  entity_fields: ProcessFieldOption[];
  message_tokens?: ProcessMessageToken[];
}

/** Fields a stage can require-before-exit for this pipeline: deal fields plus
 *  the entity's own fields (contact custom fields or datasheet columns). */
export async function getProcessFieldOptions(processId: number): Promise<ProcessFieldOptions> {
  return apiFetch<ProcessFieldOptions>(`/processes/${processId}/field-options`, { method: 'GET', auth: true });
}

// ---------- Entity form (edit underlying contact / datasheet record) ----------

export interface EntityFormFieldDef {
  key: string;            // core:<attr> | contact:<field_def_id> | record:<field_name>
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'email' | 'phone' | 'url';
  value: any;
  options: string[] | null;
  required: boolean;
  readonly: boolean;
  group: string;
}
export interface EntityForm {
  entity_type: string;
  entity_id: number;
  entity_label: string | null;
  fields: EntityFormFieldDef[];
}

/** The underlying entity's editable fields + values for a pipeline entry. */
export async function getEntityForm(processId: number, entryId: number): Promise<EntityForm> {
  return apiFetch<EntityForm>(`/processes/${processId}/entries/${entryId}/entity-form`, { method: 'GET', auth: true });
}

/** Persist edited entity fields back to the contact / datasheet record. */
export async function saveEntityForm(
  processId: number, entryId: number, values: Record<string, any>,
): Promise<EntityForm> {
  return apiFetch<EntityForm>(`/processes/${processId}/entries/${entryId}/entity-form`, {
    method: 'PATCH', auth: true,
    body: JSON.stringify({ values }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Templates / Starters ----------

export interface ProcessTemplateStarter {
  key: string;
  name: string;
  industry: string;
  description: string;
  icon?: string | null;
  entity_type: string;
  stages: Array<Record<string, any>>;
}

export async function listProcessTemplates(): Promise<ProcessTemplateStarter[]> {
  return apiFetch<ProcessTemplateStarter[]>(`/processes/templates/starters`, { method: 'GET', auth: true });
}

export async function createFromTemplate(template_key: string, name_override?: string, color?: string): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/from-template`, {
    method: 'POST', auth: true,
    body: JSON.stringify({ template_key, name_override, color }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Automation Rules ----------

export type AutomationTrigger =
  | 'on_added'      // entry first lands in the process (process-wide)
  | 'on_enter'      // entry enters a specific stage
  | 'on_exit'       // entry leaves a specific stage
  | 'on_stuck'      // SLA breach on a stage (or any stage if stage_id null)
  | 'on_complete'   // entry reached a terminal "completed" stage
  | 'on_drop';      // entry reached a terminal "failed" stage

/** A single AND-condition evaluated against the event context before the
 *  rule's action fires. Same shape as the generic AutomationRule.conditions. */
export interface AutomationCondition {
  /** Dotted path resolved against the event context, e.g. `entry.priority`. */
  field: string;
  /** Operator: eq | neq | gt | gte | lt | lte | in | not_in | contains
   *  | is_empty | is_not_empty | days_since_gt | days_since_lt
   *  | days_until_gt | days_until_lt. */
  op: string;
  /** JSON-serialisable comparison value. `in` / `not_in` expect arrays. */
  value: any;
}

export interface AutomationRule {
  id: number;
  process_id: number;
  stage_id: number | null;
  trigger: AutomationTrigger;
  action: Record<string, any>;
  conditions: AutomationCondition[];
  is_active: boolean;
  created_at: string;
}

export async function listAutomations(processId: number): Promise<AutomationRule[]> {
  return apiFetch<AutomationRule[]>(`/processes/${processId}/automations`, { method: 'GET', auth: true });
}

export async function createAutomation(processId: number, payload: {
  trigger: AutomationTrigger;
  stage_id?: number | null;
  action: Record<string, any>;
  conditions?: AutomationCondition[];
  is_active?: boolean;
}): Promise<AutomationRule> {
  return apiFetch<AutomationRule>(`/processes/${processId}/automations`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteAutomation(processId: number, automationId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/automations/${automationId}`, { method: 'DELETE', auth: true });
}

// ---------- Per-entity pipeline entries (for embedded panels) ----------

export async function getContactPipelineEntries(
  contactId: number,
  status?: string,
): Promise<ProcessEntryWithProcess[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ProcessEntryWithProcess[]>(`/contacts/${contactId}/pipeline-entries${qs}`, { method: 'GET', auth: true });
}

export async function getLeadPipelineEntries(
  leadId: number,
  status?: string,
): Promise<ProcessEntryWithProcess[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ProcessEntryWithProcess[]>(`/contacts/${leadId}/pipeline-entries${qs}`, { method: 'GET', auth: true });
}

export async function listProcessesForEntityType(entityType: 'lead' | 'contact' | 'datasheet_record'): Promise<BusinessProcessListItem[]> {
  const all = await listProcesses('active');
  return all.filter(p => p.entity_type === entityType || p.entity_type === 'lead');
}
