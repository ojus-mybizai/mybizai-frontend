import { apiFetch } from '@/lib/api-client';

export type EntityKind = 'datasheet' | 'contact' | 'none';
export type RowCount = 'single' | 'multi';
export type AssigneeMode = 'specific' | 'role' | 'prompt';
export type DeliveryChannel = 'auto' | 'whatsapp' | 'in_app' | 'both';
export type DeliveryMode = 'one_per_child' | 'bundled_per_assignee';

export type CompletionSignal =
  | 'manual'
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'field_changed'
  | 'fields_filled'
  | 'field_equals'
  | 'contact_field_filled'
  | 'contact_field_equals'
  | 'contact_tagged'
  | 'contact_added_to_group'
  | 'stage_reached';

export interface CompletionCondition {
  signal: CompletionSignal;
  entity_kind?: EntityKind;
  datasheet_id?: number | null;
  fields?: string[];
  field?: string;
  value?: string;
  tag_id?: number;
  group_id?: number;
  stage_id?: number;
}

export interface TemplateVariable {
  name: string;
  label?: string;
  required?: boolean;
  hint?: string;
}

export interface TaskTemplate {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;

  title_pattern: string;
  instructions: string | null;
  task_type: 'simple' | 'app_action';
  priority: 'low' | 'normal' | 'high';
  due_in_days: number | null;

  assignee_mode: AssigneeMode;
  assignee_member_id: number | null;
  assignee_role_id: number | null;
  round_robin_within_role: boolean;

  delivery_channel: DeliveryChannel;
  delivery_mode: DeliveryMode;
  completion_condition: CompletionCondition | null;

  entity_kind: EntityKind;
  entity_datasheet_id: number | null;
  row_count: RowCount;

  variables: TemplateVariable[];
  deep_link_path: string | null;

  use_count: number;
  last_used_at: string | null;
  created_by_member_id: number | null;
  created_at: string | null;
  updated_at: string | null;

  // Task Reminder Spec §2.2
  reminder_enabled: boolean;
  reminder_interval_hours: number;
  snooze_hours: number;
  max_reminders: number;

  // Task Reminder Config v2
  is_default: boolean;
  cadence_mode: 'delivery' | 'due' | 'hybrid';
  due_offsets_hours: number[];
  escalate_after_due_hours: number | null;
  snooze_presets: SnoozePreset[];
  max_self_reschedules: number;
}

export type SnoozePreset =
  | { label: string; hours: number }
  | { label: string; day_offset: number; time: string }
  | { label: string; custom: true };

export interface TaskTemplateCreatePayload {
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean;

  title_pattern: string;
  instructions?: string | null;
  task_type?: 'simple' | 'app_action';
  priority?: 'low' | 'normal' | 'high';
  due_in_days?: number | null;

  assignee_mode?: AssigneeMode;
  assignee_member_id?: number | null;
  assignee_role_id?: number | null;
  round_robin_within_role?: boolean;

  delivery_channel?: DeliveryChannel;
  delivery_mode?: DeliveryMode;
  completion_condition?: CompletionCondition | null;

  entity_kind?: EntityKind;
  entity_datasheet_id?: number | null;
  row_count?: RowCount;

  variables?: TemplateVariable[];
  deep_link_path?: string | null;

  reminder_enabled?: boolean;
  reminder_interval_hours?: number;
  snooze_hours?: number;
  max_reminders?: number;

  cadence_mode?: 'delivery' | 'due' | 'hybrid';
  due_offsets_hours?: number[];
  escalate_after_due_hours?: number | null;
  snooze_presets?: SnoozePreset[];
  max_self_reschedules?: number;
}

export type TaskTemplateUpdatePayload = Partial<TaskTemplateCreatePayload>;

export interface TemplateAssignPayload {
  variables?: Record<string, unknown>;
  per_row_variables?: Record<number, Record<string, unknown>>;
  target_records?: number[];
  target_contacts?: number[];
  assignee_override?: { member_id?: number; role?: string };
  confirm_large?: boolean;
}

export interface TemplateAssignResponse {
  parent_task_id: number | null;
  child_task_ids: number[];
  total: number;
  delivered: number;
}

export async function listTaskTemplates(activeOnly = true): Promise<TaskTemplate[]> {
  const qs = activeOnly ? '?active_only=true' : '';
  return apiFetch<TaskTemplate[]>(`/task-templates/${qs}`, { method: 'GET', auth: true });
}

export async function getTaskTemplate(id: number): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`/task-templates/${id}`, { method: 'GET', auth: true });
}

export async function createTaskTemplate(payload: TaskTemplateCreatePayload): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>('/task-templates/', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateTaskTemplate(
  id: number,
  payload: TaskTemplateUpdatePayload,
): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`/task-templates/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  return apiFetch<void>(`/task-templates/${id}`, { method: 'DELETE', auth: true });
}

export async function assignTaskTemplate(
  id: number,
  payload: TemplateAssignPayload,
): Promise<TemplateAssignResponse> {
  return apiFetch<TemplateAssignResponse>(`/task-templates/${id}/assign`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export interface TargetPreviewRow {
  id: number;
  label: string;
}

export interface TargetPreviewResponse {
  count: number;
  sample: TargetPreviewRow[];
}

export async function previewTargets(
  id: number,
  groupId?: number,
): Promise<TargetPreviewResponse> {
  const qs = groupId ? `?group_id=${groupId}` : '';
  return apiFetch<TargetPreviewResponse>(`/task-templates/${id}/target-preview${qs}`, {
    method: 'GET',
    auth: true,
  });
}
