import { apiFetch } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────

export interface BuilderTurnResponse {
  reply: string;
  phase: string;
  phase_progress: Record<string, 'complete' | 'current' | 'pending'>;
  collected: Record<string, unknown>;
  blueprint_preview: Record<string, unknown> | null;
  apply_result: {
    success: boolean;
    created: Record<string, number>;
    skipped: Record<string, number>;
    errors: string[];
  } | null;
}

export interface BuilderState {
  active: boolean;
  phase: string | null;
  phase_progress: Record<string, string> | null;
  collected: Record<string, unknown> | null;
  blueprint_preview: Record<string, unknown> | null;
}

export interface SeedTemplate {
  slug: string;
  name: string;
  description: string;
  industry: string;
}

// ── API Functions ─────────────────────────────────────────────────────

export async function sendBuilderMessage(
  message: string,
): Promise<BuilderTurnResponse> {
  return apiFetch<BuilderTurnResponse>('/builder/turn', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getBuilderState(): Promise<BuilderState> {
  return apiFetch<BuilderState>('/builder/state', { method: 'GET' });
}

export async function resetBuilder(): Promise<void> {
  await apiFetch('/builder/reset', { method: 'POST' });
}

export async function applyBuilderBlueprint(): Promise<{
  success: boolean;
  created: Record<string, number>;
  skipped: Record<string, number>;
  errors: string[];
}> {
  return apiFetch('/builder/apply', { method: 'POST' });
}

export async function editBuilderSection(
  section: string,
  instruction: string,
): Promise<BuilderTurnResponse> {
  return apiFetch<BuilderTurnResponse>('/builder/edit-section', {
    method: 'POST',
    body: JSON.stringify({ section, instruction }),
  });
}

export async function getBuilderTemplates(): Promise<SeedTemplate[]> {
  const res = await apiFetch<{ templates: SeedTemplate[] }>(
    '/builder/templates',
    { method: 'GET' },
  );
  return res.templates;
}

export async function getReviewSummary(): Promise<string> {
  const res = await apiFetch<{ summary: string }>('/builder/review-summary', {
    method: 'GET',
  });
  return res.summary;
}
