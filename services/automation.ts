import { apiFetch } from '@/lib/api-client';

export type RuleCategory = 'notification' | 'work' | 'data' | 'schedule' | 'communication' | 'general';

export const RULE_CATEGORIES: { key: RuleCategory; label: string; icon: string; color: string }[] = [
  { key: 'notification', label: 'Notifications', icon: 'bell', color: 'text-blue-400' },
  { key: 'work', label: 'Work & Tasks', icon: 'briefcase', color: 'text-purple-400' },
  { key: 'data', label: 'Data Changes', icon: 'database', color: 'text-emerald-400' },
  { key: 'schedule', label: 'Scheduled', icon: 'clock', color: 'text-amber-400' },
  { key: 'communication', label: 'Communication', icon: 'message-circle', color: 'text-pink-400' },
  { key: 'general', label: 'General', icon: 'zap', color: 'text-text-secondary' },
];

export interface AutomationRule {
  id: number;
  business_id: number;
  name: string;
  description?: string | null;
  category?: RuleCategory | null;
  trigger: { event: string; filters?: Record<string, any>; schedule?: { type: string; time?: string; day?: string } };
  conditions: Array<{ field?: string; op?: string; value?: any; query?: any }>;
  actions: Array<{ type: string; params: Record<string, any> }>;
  is_active: boolean;
  run_count: number;
  last_run_at?: string | null;
  last_error?: string | null;
  created_by_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AutomationRuleListResponse {
  items: AutomationRule[];
  total: number;
}

export interface EventOption {
  event: string;
  label: string;
  description: string;
  category: string;
  has_filters: boolean;
  filter_fields: Array<{ name: string; label: string; options?: string[] }>;
  /** Condition-field groups that apply to this trigger (keys into condition_fields). */
  condition_roots: string[];
  /** False = listed but not yet executable; render disabled / "coming soon". */
  available: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
  value_type: 'text' | 'number' | 'date' | 'enum';
  options: string[];
}

export interface OperatorOption {
  value: string;
  label: string;
  /** Field value_types this operator applies to. Empty = all. */
  applies_to: string[];
  /** How the value input should render. */
  input: 'text' | 'number' | 'list' | 'none';
}

export interface ActionOption {
  type: string;
  label: string;
  description: string;
  category: string;
  param_schema: Array<{ name: string; type: string; label: string; required: boolean; options?: string[] }>;
  /** False = catalogued but handler not wired yet; render disabled. */
  available: boolean;
}

export interface AutomationMetadata {
  events: EventOption[];
  actions: ActionOption[];
  operators: OperatorOption[];
  /** Condition fields grouped by context root ("contact", "entry", ...). */
  condition_fields: Record<string, FieldOption[]>;
}

export async function getAutomationMetadata(): Promise<AutomationMetadata> {
  return apiFetch('/automation/metadata', { method: 'GET', auth: true });
}

export async function listAutomationRules(): Promise<AutomationRuleListResponse> {
  return apiFetch('/automation/rules', { method: 'GET', auth: true });
}

export async function createAutomationRule(data: Omit<AutomationRule, 'id' | 'business_id' | 'run_count' | 'last_run_at' | 'last_error' | 'created_by_id' | 'created_at' | 'updated_at'>): Promise<AutomationRule> {
  return apiFetch('/automation/rules', { method: 'POST', auth: true, body: JSON.stringify(data) });
}

export async function updateAutomationRule(id: number, data: Partial<AutomationRule>): Promise<AutomationRule> {
  return apiFetch(`/automation/rules/${id}`, { method: 'PATCH', auth: true, body: JSON.stringify(data) });
}

export async function deleteAutomationRule(id: number): Promise<void> {
  return apiFetch(`/automation/rules/${id}`, { method: 'DELETE', auth: true });
}

export async function toggleAutomationRule(id: number): Promise<AutomationRule> {
  return apiFetch(`/automation/rules/${id}/toggle`, { method: 'POST', auth: true });
}

// AI Suggestion
export interface AISuggestResponse {
  suggestion: Record<string, unknown> | null;
  error: string | null;
}

export async function aiSuggestRule(prompt: string): Promise<AISuggestResponse> {
  return apiFetch<AISuggestResponse>('/automation/ai-suggest', {
    method: 'POST', auth: true,
    body: JSON.stringify({ prompt }),
    headers: { 'Content-Type': 'application/json' },
  });
}
