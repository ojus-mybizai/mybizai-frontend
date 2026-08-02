import { apiFetch } from '@/lib/api-client';
import type { Block } from '@/lib/agent-blocks';

// Mirrors backend app/modules/system_builder/spec.py.

export const SYSTEM_KINDS = ['complaint', 'sales', 'remarketing', 'marketing', 'custom'] as const;
export type SystemKind = (typeof SYSTEM_KINDS)[number];

/** A System manifest — a thin envelope; each section is a specialist's native design. */
export interface SystemBlueprint {
  name: string;
  kind: SystemKind | string;
  goal?: string;
  sections: Record<string, Record<string, unknown>>;
  /** Plain-language "now you can…" capabilities the AI authored — no numbers. */
  outcomes?: string[];
  effort_saved?: string;
}

/* ── Rich-input interview (Phase 1) ───────────────────────────────────── */

export type QuestionType =
  | 'single_select'
  | 'multi_select'
  | 'list_builder'
  | 'toggle'
  | 'text'
  | 'number';

/** Where an option came from — the UI styles real things vs AI suggestions. */
export type OptionSource =
  | 'existing_tag'
  | 'existing_group'
  | 'datasheet'
  | 'field'
  | 'staff'
  | 'channel'
  | 'ai';

export interface QuestionOption {
  label: string;
  value: string;
  source?: OptionSource;
}

/** One interview question with a proper input widget. Mirrors backend prompt.py. */
export interface Question {
  /** STABLE dot-path key → the answer key (e.g. "contacts.groups"). */
  id: string;
  type: QuestionType;
  /** For single_select / multi_select only. */
  options?: QuestionOption[];
  allow_custom?: boolean;
  placeholder?: string;
  min?: number | null;
  max?: number | null;
}

export interface DraftResponse {
  mode: 'ask' | 'propose';
  message: string;
  /** Plain-language reason the question is being asked (ask turns). */
  why?: string;
  /** Which System section this question belongs to (advisory). */
  section?: string;
  /** The rich input widget spec for this ask turn. */
  question?: Question | null;
  blueprint?: SystemBlueprint | null;
  canvas?: Block[] | null;
  issues?: string[];
}

export interface StepSummary {
  step: string;
  ok: boolean;
  components: number;
  warnings: string[];
}

export interface ApplyResult {
  system_id: number;
  name: string;
  kind: string;
  status: string;
  components: number;
  steps: StepSummary[];
  warnings: string[];
}

export interface ApplyResponse {
  result: ApplyResult;
  message: string;
  canvas: Block[];
  envelope: Record<string, unknown>;
}

export interface SystemSummary {
  id: number;
  name: string;
  kind: string;
  status: string;
  /** Custom appearance for manually-composed Systems (null → fall back to KIND_META). */
  icon?: string | null;
  color?: string | null;
  created_at: string | null;
}

export interface SystemComponent {
  id: number;
  type: string;
  component_id: number | null;
  ref_key: string | null;
  step: string | null;
  meta: Record<string, unknown> | null;
  /** True = AI-built & owned (delete tears down config); false = manual link. */
  owned?: boolean;
  sort_order?: number;
}

export interface SystemDetail extends SystemSummary {
  goal: string | null;
  outcomes?: string[] | null;
  components: SystemComponent[];
}

export function draftSystem(
  message: string,
  history?: { role: string; content: string }[],
  answers?: Record<string, unknown>
): Promise<DraftResponse> {
  return apiFetch<DraftResponse>('/system-builder/draft', {
    method: 'POST',
    body: JSON.stringify({ message, history, answers }),
  });
}

/* ── Phase 2: stateful, resumable session ─────────────────────────────── */

/** Per-section build state. */
export type StepStatus = 'pending' | 'proposed' | 'built' | 'skipped';

/** The working manifest under construction — a loose superset of SystemBlueprint. */
export interface WorkingPlan {
  name?: string;
  kind?: string;
  goal?: string;
  sections: Record<string, Record<string, unknown>>;
  outcomes?: string[];
  effort_saved?: string;
  /** Sections the owner toggled off (stashed, not lost). */
  _disabled?: Record<string, Record<string, unknown>>;
}

/** One persisted transcript turn, rehydrated on resume. */
export interface TranscriptMsg {
  role: 'user' | 'assistant';
  content: string;
  canvas?: Block[] | null;
  why?: string | null;
  question?: Question | null;
  issues?: string[] | null;
  mode?: string | null;
  section?: string | null;
}

export interface SessionState {
  session_id: number;
  status: string;
  /** "onboarding" (first-run whole-business setup) | "manual". */
  origin?: string;
  plan: WorkingPlan;
  step_statuses: Record<string, StepStatus>;
  answers: Record<string, unknown>;
  system_id: number | null;
  canvas?: Block[] | null;
  transcript: TranscriptMsg[];
}

/** Result of opening the onboarding hard gate from the builder session. */
export interface OpenAppResponse {
  onboarding_completed: boolean;
  gate_opened: boolean;
  plan_selection_required: boolean;
  memory_file_id?: number | null;
}

/** A rich answer sent to the server — patches the working plan directly. */
export interface AnswerInput {
  question_id: string;
  value: unknown;
  /** Human labels for selection widgets, so the built System uses real names. */
  labels?: string[];
}

export interface SessionDraftResponse extends DraftResponse {
  plan: WorkingPlan;
  step_statuses: Record<string, StepStatus>;
  session_id: number;
}

export interface PlanPatchResponse {
  plan: WorkingPlan;
  step_statuses: Record<string, StepStatus>;
}

export interface BuildSectionResponse {
  step: string;
  system_id: number;
  status: string;
  components: number;
  step_statuses: Record<string, StepStatus>;
  warnings: string[];
  already_built?: boolean;
}

/** Get-or-create the caller's in-progress session (the resume entry point). */
export function openSession(): Promise<SessionState> {
  return apiFetch<SessionState>('/system-builder/session', { method: 'POST' });
}

/** Open the onboarding hard gate: write the profile MemoryFile + set
 * onboarding_completed from what the interview has captured. Idempotent. */
export function openApp(): Promise<OpenAppResponse> {
  return apiFetch<OpenAppResponse>('/system-builder/session/open-app', { method: 'POST' });
}

/** One server-side stateful interview turn. Send a message OR a rich answer. */
export function sessionDraft(
  body: { message?: string; answer?: AnswerInput }
): Promise<SessionDraftResponse> {
  return apiFetch<SessionDraftResponse>('/system-builder/session/draft', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Structural plan edit (binding, no LLM): op ∈ set | remove | toggle_section. */
export function patchPlan(
  op: 'set' | 'remove' | 'toggle_section',
  path: string,
  value?: unknown
): Promise<PlanPatchResponse> {
  return apiFetch<PlanPatchResponse>('/system-builder/session/plan', {
    method: 'PATCH',
    body: JSON.stringify({ op, path, value }),
  });
}

/** Build ONE section now (section-scoped rollback on failure). */
export function buildSection(step: string): Promise<BuildSectionResponse> {
  return apiFetch<BuildSectionResponse>('/system-builder/session/build-section', {
    method: 'POST',
    body: JSON.stringify({ step }),
  });
}

/** Build all not-yet-built sections and activate the System. */
export function finalizeSession(): Promise<ApplyResponse> {
  return apiFetch<ApplyResponse>('/system-builder/session/finalize', { method: 'POST' });
}

export function applySystem(blueprint: SystemBlueprint): Promise<ApplyResponse> {
  return apiFetch<ApplyResponse>('/system-builder/apply', {
    method: 'POST',
    body: JSON.stringify({ blueprint }),
  });
}

export function listSystems(): Promise<{ systems: SystemSummary[] }> {
  return apiFetch('/system-builder/systems', { method: 'GET' });
}

/* ── Sidebar nav payload ──────────────────────────────────────────────── */

export interface SystemNavRef {
  id: number;
  name: string;
}

/** Component types that can appear as a navigable child in the sidebar. */
export type NavChildType =
  | 'datasheet_model'
  | 'pipeline'
  | 'agent'
  | 'dashboard_layout'
  | 'nav_link';

/** One navigable child of a System, in the owner's manual sort order. */
export interface SystemNavChild {
  type: NavChildType;
  id: number | null;
  href: string;
  name: string;
  /** Lucide icon name (resolved to a component client-side). */
  icon: string;
  module?: string | null;
}

/** A System reduced to only its navigable parts — drives the sidebar.
 * `items` is the current, ordered source of truth; the singleton fields
 * (datasheets/agent/pipeline/dashboard) are kept for backward-compat. */
export interface SystemNavItem extends SystemSummary {
  items: SystemNavChild[];
  datasheets: SystemNavRef[];
  agent: SystemNavRef | null;
  pipeline: SystemNavRef | null;
  /** The System's dedicated dashboard layout (deep-linked via /dashboard?layout=id). */
  dashboard: SystemNavRef | null;
  has_dashboard: boolean;
}

export interface SystemsNavResponse {
  systems: SystemNavItem[];
  /** Datasheet model ids that belong to a System (so the rest are "General Data"). */
  owned_datasheet_ids: number[];
  /** Preferred alias for owned_datasheet_ids (union of datasheet components). */
  included_datasheet_ids?: number[];
}

/** One call → every System with its navigable components, for the sidebar. */
export function getSystemsNav(): Promise<SystemsNavResponse> {
  return apiFetch<SystemsNavResponse>('/system-builder/nav', { method: 'GET' });
}

export function getSystem(id: number): Promise<SystemDetail> {
  return apiFetch(`/system-builder/systems/${id}`, { method: 'GET' });
}

export interface DeleteSystemResponse {
  ok: boolean;
  system_id: number;
  /** Underlying config rows removed. */
  deleted: number;
  /** Components whose underlying row was already gone. */
  skipped: number;
  /** Per-component failures (best-effort teardown). */
  errors: string[];
}

/** Permanently delete a System and the configuration it owns (datasheets +
 * their data, pipeline, dashboard, agent, contact groups/tags). Contacts are
 * kept — only group/tag definitions are removed. Owner-gated (manage_settings). */
export function deleteSystem(id: number): Promise<DeleteSystemResponse> {
  return apiFetch(`/system-builder/systems/${id}`, { method: 'DELETE' });
}

/* ── Manual System composition ────────────────────────────────────────── */

export interface PickableItem {
  id: number;
  name: string;
  /** Ids of Systems that already include this item. */
  in_systems: number[];
}

export interface CoreModuleItem {
  module: string;
  label: string;
  href: string;
  icon: string;
}

export interface PickableItems {
  datasheets: PickableItem[];
  pipelines: PickableItem[];
  agents: PickableItem[];
  dashboards: PickableItem[];
  core_modules: CoreModuleItem[];
  supports_custom_link: boolean;
}

/** A scoped nav_link descriptor — a filtered/deep-linked core-module view.
 * The backend adapter rebuilds the href + live label from this. */
export interface ScopeDescriptor {
  module: string;
  entity_id?: number | null;
  params: Record<string, string | number>;
}

/** One item to attach as a link. Real artefacts pass {type, id}; a plain
 * nav_link passes {type:'nav_link', href, label, ...}; a scoped nav_link passes
 * {type:'nav_link', scope, label?} (server computes href + auto-label). */
export interface AttachComponent {
  type: NavChildType;
  id?: number;
  ref_key?: string;
  href?: string;
  label?: string;
  icon?: string;
  module?: string;
  scope?: ScopeDescriptor;
}

/** Create an empty, manually-composed System. Owner-gated. */
export function createSystem(body: {
  name: string;
  icon?: string;
  color?: string;
  kind?: string;
  goal?: string;
}): Promise<SystemSummary> {
  return apiFetch('/system-builder/systems', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Rename / recolor / re-icon / edit goal or kind. Owner-gated. */
export function patchSystem(
  id: number,
  body: { name?: string; icon?: string; color?: string; kind?: string; goal?: string }
): Promise<SystemSummary> {
  return apiFetch(`/system-builder/systems/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Attach existing items (or nav_links) to a System as links (owned=false). */
export function attachComponents(
  systemId: number,
  components: AttachComponent[]
): Promise<{ ok: boolean; attached: number }> {
  return apiFetch(`/system-builder/systems/${systemId}/components`, {
    method: 'POST',
    body: JSON.stringify({ components }),
  });
}

/** Detach a component. Owned rows require `deleteConfig` (true = tear down the
 * underlying config, false = keep it and only unlink); linked rows ignore it. */
export function detachComponent(
  systemId: number,
  rowId: number,
  deleteConfig?: boolean
): Promise<{ ok: boolean; detached: boolean; config_deleted: boolean }> {
  const q = deleteConfig === undefined ? '' : `?delete_config=${deleteConfig}`;
  return apiFetch(`/system-builder/systems/${systemId}/components/${rowId}${q}`, {
    method: 'DELETE',
  });
}

/** Override (or clear, with an empty string) a component's display label —
 * chiefly for renaming a scoped nav_link's auto-label. Owner-gated. */
export function patchComponentLabel(
  systemId: number,
  rowId: number,
  label: string
): Promise<{ ok: boolean; label: string | null }> {
  return apiFetch(`/system-builder/systems/${systemId}/components/${rowId}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });
}

/** Persist a manual drag-sort — `order` is component row ids in desired order. */
export function reorderComponents(
  systemId: number,
  order: number[]
): Promise<{ ok: boolean }> {
  return apiFetch(`/system-builder/systems/${systemId}/components/order`, {
    method: 'PATCH',
    body: JSON.stringify({ order }),
  });
}

/** Everything a System can attach, grouped by type + core-module catalog. */
export function getPickableItems(): Promise<PickableItems> {
  return apiFetch('/system-builder/pickable-items', { method: 'GET' });
}
