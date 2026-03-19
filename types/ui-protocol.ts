/**
 * Dynamic UI Response Protocol — Phase 1
 * Type definitions for AI agent structured UI responses.
 * Used by chat API; rendering is implemented in Phase 2.
 */

// ---------------------------------------------------------------------------
// Base UI response (generic block)
// ---------------------------------------------------------------------------

export interface UIResponseBase {
  type: string;
  title?: string;
  description?: string;
  component: string;
  data?: unknown;
  actions?: unknown[];
}

// ---------------------------------------------------------------------------
// Component-specific block types
// ---------------------------------------------------------------------------

export interface UIText {
  type: 'text';
  content: string;
}

export interface UITableColumn {
  key: string;
  label: string;
}

export interface UITable {
  type: 'table';
  title?: string;
  data_api: string;
  columns?: UITableColumn[];
  reloadable?: boolean;
}

export interface UIFormField {
  name: string;
  type: string;
  label: string;
}

export interface UIForm {
  type: 'form';
  title?: string;
  submit_api: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  fields: UIFormField[];
}

export interface UIChart {
  type: 'chart';
  title?: string;
  chart_type: string;
  data_api: string;
}

export interface UIConfirmation {
  type: 'confirmation';
  title?: string;
  message: string;
  confirm_api: string;
  method?: 'DELETE' | 'POST' | 'PUT';
}

export interface UIModal {
  type: 'modal';
  title?: string;
  data_api: string;
}

export interface UICard {
  type: 'card';
  title?: string;
  data_api: string;
}

// ---------------------------------------------------------------------------
// Union of all UI block types
// ---------------------------------------------------------------------------

export type UIBlock =
  | UIText
  | UITable
  | UIForm
  | UIChart
  | UIConfirmation
  | UIModal
  | UICard;

// ---------------------------------------------------------------------------
// Agent UI response (hybrid: message + optional blocks)
// ---------------------------------------------------------------------------

export interface AgentUIResponse {
  message?: string;
  blocks?: UIBlock[];
}

// ---------------------------------------------------------------------------
// Chat API response shape
// ---------------------------------------------------------------------------

export interface ChatAPIResponse {
  reply: string;
  ui: AgentUIResponse | null;
}
