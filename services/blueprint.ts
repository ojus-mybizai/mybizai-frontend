import { apiFetch } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────

export interface BlueprintTemplateSummary {
  slug: string;
  name: string;
  description: string | null;
  industry: string | null;
  icon: string | null;
  tags: string[];
  counts: Record<string, number>;
}

export interface BlueprintApplyResult {
  success: boolean;
  created: Record<string, number>;
  skipped: Record<string, number>;
  errors: string[];
}

export interface BlueprintValidateResult {
  valid: boolean;
  name?: string;
  counts?: Record<string, number>;
  error?: string;
}

// Full blueprint JSON (for preview)
export type BlueprintJSON = Record<string, unknown>;

// ── API Functions ─────────────────────────────────────────────────────

/**
 * List all available V2 templates.
 */
export async function listTemplates(): Promise<BlueprintTemplateSummary[]> {
  return apiFetch<BlueprintTemplateSummary[]>(
    '/blueprints/v2/templates',
    { method: 'GET' }
  );
}

/**
 * Get full JSON of a specific template by slug.
 */
export async function getTemplate(slug: string): Promise<BlueprintJSON> {
  return apiFetch<BlueprintJSON>(
    `/blueprints/v2/templates/${slug}`,
    { method: 'GET' }
  );
}

/**
 * Validate a blueprint JSON without applying.
 */
export async function validateBlueprint(
  blueprint: BlueprintJSON
): Promise<BlueprintValidateResult> {
  return apiFetch<BlueprintValidateResult>(
    '/blueprints/v2/validate',
    { method: 'POST', body: JSON.stringify(blueprint) }
  );
}

/**
 * Apply a blueprint JSON to the current business.
 */
export async function applyBlueprint(
  blueprint: BlueprintJSON
): Promise<BlueprintApplyResult> {
  return apiFetch<BlueprintApplyResult>(
    '/blueprints/v2/apply',
    { method: 'POST', body: JSON.stringify(blueprint) }
  );
}

/**
 * Apply a pre-built template by slug.
 */
export async function applyTemplate(
  slug: string
): Promise<BlueprintApplyResult> {
  return apiFetch<BlueprintApplyResult>(
    `/blueprints/v2/apply-template/${slug}`,
    { method: 'POST' }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Map industry slug to a display-friendly icon name (lucide-react) */
export function getIndustryIcon(industry: string | null): string {
  const map: Record<string, string> = {
    healthcare: 'stethoscope',
    real_estate: 'building-2',
    ecommerce: 'shopping-cart',
    restaurant: 'utensils',
    consulting: 'briefcase',
    education: 'graduation-cap',
    fitness: 'dumbbell',
    salon: 'scissors',
    automotive: 'car',
  };
  return map[industry || ''] || 'layout-template';
}

/** Get a friendly label for a count key */
export function getCountLabel(key: string): string {
  const labels: Record<string, string> = {
    datasheets: 'Datasheets',
    roles: 'Roles',
    agents: 'AI Agents',
    automations: 'Automations',
    pipeline_stages: 'Pipeline Stages',
    work_templates: 'Work Templates',
    processes: 'Processes',
    knowledge_base: 'KB Entries',
    followup_rules: 'Follow-ups',
  };
  return labels[key] || key.replace(/_/g, ' ');
}

/** Get an emoji for a count key */
export function getCountEmoji(key: string): string {
  const emojis: Record<string, string> = {
    datasheets: '📁',
    roles: '👥',
    agents: '🤖',
    automations: '⚡',
    pipeline_stages: '📊',
    work_templates: '📋',
    processes: '🔄',
    knowledge_base: '📝',
    followup_rules: '📬',
  };
  return emojis[key] || '📦';
}
