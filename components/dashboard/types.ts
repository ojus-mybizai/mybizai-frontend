import type { AgentUIResponse } from '@/types/ui-protocol';
import type { SkillState as ToolState } from './skill-state-display';

export type ChatRole = 'user' | 'assistant' | 'webhook';

// ─── Manager Agent UI block types ────────────────────────────────────────────

export interface SlotField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'date' | 'datetime-local' | 'time' | 'select' | 'relation';
  value?: string | number;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  default?: string;
  /** For relation type: the dynamic model ID to search against */
  relation_model_id?: number;
  /** Human-readable name of the related model */
  relation_display_name?: string;
  /** Server-sent validation error for this field (shown immediately on re-render) */
  error?: string;
}

export interface AgentUIBlockSlotForm {
  type: 'slot_form';
  intent: string;
  title: string;
  fields: SlotField[];
  submit_label?: string;
  /** Optional plan context shown above the form (e.g. "Found Patient: Harish ✓") */
  plan_text?: string;
}

export interface AgentUIBlockConfirmation {
  type: 'confirmation_card';
  intent: string;
  title: string;
  summary: string;
  rows: Array<{ label: string; value: string }>;
  confirm_label?: string;
  cancel_label?: string;
}

export interface AgentUIBlockSuccess {
  type: 'success_card';
  title: string;
  rows: Array<{ label: string; value: string }>;
}

export interface AgentUIBlockTable {
  type: 'table';
  title: string;
  /** column.type maps to the DynamicField field_type — used to render image/file cells */
  columns: Array<{ key: string; label: string; type?: string }>;
  rows: Record<string, unknown>[];
  total?: number;
}

export type AgentUIBlock =
  | AgentUIBlockSlotForm
  | AgentUIBlockConfirmation
  | AgentUIBlockSuccess
  | AgentUIBlockTable;

// ─── Message ─────────────────────────────────────────────────────────────────

export interface DashboardMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Legacy dynamic UI (agent_engine / DynamicRenderer path) */
  ui?: AgentUIResponse | null;
  /** New Manager Agent UI block (slot_form / confirmation_card / success_card / table) */
  agent_ui?: AgentUIBlock | null;
  tool_states?: ToolState[];
  source?: 'chat' | 'webhook';
  created_at?: string;
}
