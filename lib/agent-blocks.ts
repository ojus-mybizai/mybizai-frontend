/**
 * P3b — Internal agent chat block protocol (single source of truth).
 *
 * The AI never authors HTML/JSX. It emits markdown plus a small, fixed catalog
 * of typed widget blocks. This file defines that catalog and the message /
 * session / saved-view shapes the internal-chat API returns. Imported
 * everywhere; defined exactly once. See P3b brief §4.
 *
 * Mirrors backend app/modules/business_agents/api/internal_chat_router.py.
 */

// ─── Design vocabulary ──────────────────────────────────────────────
// A `tone` is SEMANTIC colour: the agent tags a block with what it means and
// the renderer maps it to the app's dashboard-widget palette. See blocks/tones.ts.
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// ─── Block protocol (the 8 widgets) ─────────────────────────────────

/** DISPLAY — read-only, never emits a callback. */
export interface MarkdownBlock {
  type: 'markdown';
  id: string;
  text: string;
}

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export interface ChartBlock {
  type: 'chart';
  id: string;
  kind: 'line' | 'bar' | 'area' | 'pie';
  title?: string;
  x_key?: string;
  series: ChartSeries[];
  data: Record<string, unknown>[];
}

export interface StatItem {
  label: string;
  value: unknown;
  delta?: string;
  hint?: string;
  /** Semantic colour for this KPI tile (e.g. success for a healthy number). */
  tone?: Tone;
  /** Optional emoji shown as a small icon chip. */
  icon?: string;
}

export interface StatBlock {
  type: 'stat';
  id: string;
  items: StatItem[];
}

export interface TableBlock {
  type: 'table';
  id: string;
  title?: string;
  columns: string[];
  rows: unknown[][];
}

export interface TabsBlock {
  type: 'tabs';
  id: string;
  tabs: { title: string; blocks: Block[] }[];
}

/** INTERACTIVE — emits a Callback. */
export interface ChoiceBlock {
  type: 'choice';
  id: string;
  prompt: string;
  options: { label: string; value: string }[];
  multi: boolean;
  allow_custom: boolean;
}

export type FormFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormBlock {
  type: 'form';
  id: string;
  title?: string;
  fields: FormField[];
  submit_label: string;
}

export type ProposalAction = 'confirm' | 'change' | 'skip';

export interface ProposalBlock {
  type: 'proposal';
  id: string;
  title: string;
  summary: string;
  payload?: Record<string, unknown>;
  actions: ProposalAction[];
  /** Semantic colour for the proposal banner (default: accent). */
  tone?: Tone;
  /** Optional emoji shown before the title. */
  icon?: string;
}

// ─── Layout blocks (the canvas kit) ─────────────────────────────────
// A designed visual board: cards (heading + markdown body + media + actions)
// arranged in sections/grids. Render in the canvas pane (and inline where it
// makes sense). One registry renders both containers.

export interface Media {
  kind: 'image' | 'icon' | 'badge';
  src?: string;
  /** Datasheet attachment id — resolved to a fresh signed URL at render time. */
  attachment_id?: number;
  name?: string;
  alt?: string;
}

/** A typed navigation target; the resolver (lib/canvas-links) turns it into a URL. */
export type LinkEntity = 'contact' | 'process' | 'datasheet' | 'conversation' | 'agent' | 'work';

export interface LinkRef {
  entity: LinkEntity;
  id?: string | number;
  record_id?: string | number;
  params?: Record<string, unknown>;
}

/**
 * A card action: NAVIGATE via `href` (known app route / URL) or `link` (typed,
 * resolver-built), OR send a `action`+`values` callback to the agent.
 */
export interface Action {
  label: string;
  href?: string;
  link?: LinkRef;
  action?: string;
  values?: Record<string, unknown>;
  style?: 'primary' | 'secondary' | 'ghost';
}

export interface SectionBlock {
  type: 'section';
  id: string;
  title?: string;
  blocks: Block[];
  /** Optional emoji shown before the section title. */
  icon?: string;
  /** Semantic colour for the section title + rule. */
  tone?: Tone;
}

export interface GridBlock {
  type: 'grid';
  id: string;
  columns: 1 | 2 | 3 | 4;
  blocks: Block[];
}

export interface CardBlock {
  type: 'card';
  id: string;
  heading?: string;
  body?: string; // markdown
  media?: Media;
  blocks?: Block[];
  actions?: Action[];
  /** Semantic colour — tints the border, the icon chip and a left accent rail. */
  tone?: Tone;
  /** Optional emoji shown in a coloured chip beside the heading. */
  icon?: string;
  /** Optional short pill shown top-right (e.g. "New", "12 in stock"). */
  badge?: string;
}

export interface MediaBlock extends Media {
  type: 'media';
  id: string;
}

export type Block =
  | MarkdownBlock
  | ChartBlock
  | StatBlock
  | TableBlock
  | TabsBlock
  | ChoiceBlock
  | FormBlock
  | ProposalBlock
  | SectionBlock
  | GridBlock
  | CardBlock
  | MediaBlock;

export type InteractiveBlock = ChoiceBlock | FormBlock | ProposalBlock;

export function isInteractive(block: Block): block is InteractiveBlock {
  return block.type === 'choice' || block.type === 'form' || block.type === 'proposal';
}

// ─── Callback (block interaction → next turn) ───────────────────────

// The well-known block actions, plus any custom action string a canvas card may
// emit (the backend Callback.action is a free string). The union members give
// autocomplete; `(string & {})` keeps it open without collapsing to plain string.
export type CallbackAction = 'submit' | 'confirm' | 'change' | 'skip' | 'select' | (string & {});

export interface Callback {
  block_id: string;
  action: CallbackAction;
  values: Record<string, unknown>;
}

// ─── Messages & sessions ────────────────────────────────────────────

export interface MessageOut {
  id: number;
  role: 'user' | 'assistant' | string;
  /** Optional lead text (may be empty — blocks carry the body). */
  content: string;
  /** Ordered list, markdown + widgets interleaved. */
  blocks: Block[];
  /** The designed canvas layout this message carries (render_ui target='canvas'). */
  canvas?: Block[];
  /** Slug of the slash-command that produced this user turn (renders a chip). */
  command?: string | null;
  created_at: string | null;
  /** Phase 0 merged transcript — which agent produced this row (assistant rows only). */
  agent_id?: number | null;
  agent_kind?: string | null;
  agent_label?: string | null;
  /** Config-engine turn result (P5: used to detect a specialist's "applied" status). */
  envelope?: { status?: string; summary?: string; applied_entities?: unknown } | null;
  /** Is this message starred by the current user? */
  saved: boolean;
}

export interface AgentSummary {
  id: number;
  name: string;
  kind: string;
  /** The model this agent runs on (null = platform default). */
  model_name?: string | null;
  is_system?: boolean;
}

export interface ModelOption {
  id: string;
  is_default: boolean;
}

export interface ModelsOut {
  default: string;
  models: ModelOption[];
}

// ─── Slash commands (prompt library) ────────────────────────────────
export interface CommandOut {
  id: number;
  scope: 'global' | 'business' | 'agent';
  command: string; // slug
  title: string;
  description?: string | null;
  instruction: string;
  example_canvas: Block[];
  enabled: boolean;
  /** Inherited (global/business) relative to this agent → offer "customize" not edit. */
  inherited: boolean;
}

export interface CommandSave {
  command?: string;
  title: string;
  description?: string;
  instruction: string;
  example_canvas?: Block[] | null;
  scope: 'agent' | 'business';
  enabled?: boolean;
}

export interface SessionSummary {
  conversation_id: number;
  title: string;
  last_message_at: string | null;
}

export interface SessionMeta {
  conversation_id: number;
  title: string;
}

export interface SessionOut {
  conversation_id: number;
  agent_id: number;
  title: string;
  messages: MessageOut[];
}

export interface SendResponse {
  conversation_id: number;
  messages: MessageOut[];
}

export interface SavedViewOut {
  id: number;
  title: string;
  content: string;
  blocks: Block[];
  canvas?: Block[];
  created_at: string | null;
  source_message_id: number | null;
}
