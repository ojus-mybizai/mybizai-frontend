/**
 * Datasheet Designer chat store (conversational, multi-sheet schema design).
 *
 * Mirrors the agent builder's chat store, but the payload is a SchemaDesign (a set
 * of connected datasheets) instead of a single agent config. The design lives here
 * in the client; each turn re-sends it so the brain can extend it. Apply is per
 * datasheet (or all at once); applied sheets become real DynamicModels.
 */
import { create } from 'zustand';
import {
  draftDesign,
  applySheet as apiApplySheet,
  applyAll as apiApplyAll,
  getDesignerContext,
  type SchemaDesign,
  type DatasheetSpec,
  type FieldSpec,
  type AskQuestion,
  type DesignerContext,
} from '@/services/datasheet-builder';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  question?: AskQuestion | null;
}

const uid = () => Math.random().toString(36).slice(2);
const keyOf = (name: string) => name.trim().toLowerCase();

const GREETING =
  "Hi! I'm your datasheet designer. Tell me about your business or what you want to " +
  "track — I'll design the datasheets and how they connect. Want something simple? " +
  "Just say so.";

interface DesignerState {
  messages: ChatMessage[];
  design: SchemaDesign | null;
  context: DesignerContext | null;
  isThinking: boolean;
  busyAll: boolean;
  error: string | null;
  applied: Record<string, number>; // sheet key -> created model_id
  applyingSheet: string | null;

  reset(): void;
  loadContext(): Promise<void>;
  sendMessage(text: string): Promise<void>;
  retryLast(): Promise<void>;
  updateSheet(displayName: string, updater: (s: DatasheetSpec) => DatasheetSpec): void;
  removeSheet(displayName: string): void;
  editExisting(slug: string): void;
  applyOne(displayName: string): Promise<void>;
  applyEverything(onDone?: () => void): Promise<void>;
  clearError(): void;
}

/** Human summary of a create/update apply result. */
function summarize(res: {
  display_name: string; is_new?: boolean; created?: number; updated?: number;
  recreated?: string[]; deleted?: string[]; skipped_relations?: string[];
}): string {
  const verb = res.is_new ? 'Created' : 'Updated';
  const parts: string[] = [];
  if (res.created) parts.push(`${res.created} field(s) added`);
  if (res.updated) parts.push(`${res.updated} updated`);
  if (res.recreated?.length) parts.push(`${res.recreated.length} re-created (type change — old data dropped)`);
  if (res.deleted?.length) parts.push(`${res.deleted.length} removed`);
  if (res.skipped_relations?.length) parts.push(`${res.skipped_relations.length} link(s) skipped — create the target sheet first or use “Create all”`);
  return `✅ ${verb} “${res.display_name}”${parts.length ? ': ' + parts.join(', ') : ''}.`;
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  messages: [{ id: uid(), role: 'assistant', content: GREETING }],
  design: null,
  context: null,
  isThinking: false,
  busyAll: false,
  error: null,
  applied: {},
  applyingSheet: null,

  reset() {
    set({
      messages: [{ id: uid(), role: 'assistant', content: GREETING }],
      design: null,
      context: null,
      isThinking: false,
      busyAll: false,
      error: null,
      applied: {},
      applyingSheet: null,
    });
  },

  async loadContext() {
    try {
      const ctx = await getDesignerContext();
      const sheets = ctx.existing_datasheets.length;
      const intro =
        `I can see your **Contacts** (your communication hub)` +
        (sheets ? ` and ${sheets} existing datasheet${sheets === 1 ? '' : 's'}` : '') +
        `. Tell me about your business and I'll design the datasheets you need — and connect the right ones to your contacts so you can message them.`;
      set((s) => ({
        context: ctx,
        // Refresh the opening line only if the user hasn't started chatting yet.
        messages: s.messages.length <= 1 ? [{ id: uid(), role: 'assistant', content: intro }] : s.messages,
      }));
    } catch {
      /* keep the static greeting on failure */
    }
  },

  async sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || get().isThinking) return;
    const history = get().messages.map((m) => ({ role: m.role, content: m.content }));
    set((s) => ({
      messages: [...s.messages, { id: uid(), role: 'user', content: trimmed }],
      isThinking: true,
      error: null,
    }));
    try {
      const out = await draftDesign(trimmed, history, get().design);
      const content = out.message || (out.mode === 'propose' ? 'Here is the design I propose.' : '');
      set((s) => ({
        messages: [...s.messages, { id: uid(), role: 'assistant', content, question: out.question ?? null }],
        isThinking: false,
        design: out.mode === 'propose' && out.design ? out.design : s.design,
        error: out.issues?.length ? out.issues.join(' • ') : null,
      }));
    } catch (e) {
      set({ isThinking: false, error: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  },

  async retryLast() {
    if (get().isThinking) return;
    const msgs = get().messages;
    let idx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { idx = i; break; }
    }
    if (idx === -1) return;
    const text = msgs[idx].content;
    const history = msgs.slice(0, idx).map((m) => ({ role: m.role, content: m.content }));
    set({ messages: msgs.slice(0, idx + 1), isThinking: true, error: null });
    try {
      const out = await draftDesign(text, history, get().design);
      const content = out.message || (out.mode === 'propose' ? 'Here is the design I propose.' : '');
      set((s) => ({
        messages: [...s.messages, { id: uid(), role: 'assistant', content, question: out.question ?? null }],
        isThinking: false,
        design: out.mode === 'propose' && out.design ? out.design : s.design,
        error: out.issues?.length ? out.issues.join(' • ') : null,
      }));
    } catch (e) {
      set({ isThinking: false, error: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  },

  updateSheet(displayName, updater) {
    set((s) => {
      if (!s.design) return s;
      const datasheets = s.design.datasheets.map((d) =>
        keyOf(d.display_name) === keyOf(displayName) ? updater(d) : d
      );
      return { design: { datasheets } };
    });
  },

  removeSheet(displayName) {
    set((s) => {
      if (!s.design) return s;
      return {
        design: { datasheets: s.design.datasheets.filter((d) => keyOf(d.display_name) !== keyOf(displayName)) },
      };
    });
  },

  editExisting(slug) {
    const ds = get().context?.existing_datasheets.find((d) => d.slug === slug);
    if (!ds) return;
    const already = get().design?.datasheets.some((d) => keyOf(d.display_name) === keyOf(ds.display_name));
    if (already) return;
    const sheet: DatasheetSpec = {
      display_name: ds.display_name,
      fields: ds.fields.map((f) => ({
        name: f.name,
        display_name: f.display_name,
        field_type: f.type as FieldSpec['field_type'],
        is_required: f.required ?? false,
        options: f.options,
        relation_target: f.relation_target ?? undefined,
        relation_kind: (f.relation_kind as FieldSpec['relation_kind']) ?? undefined,
      })),
    };
    set((s) => ({ design: { datasheets: [...(s.design?.datasheets ?? []), sheet] } }));
  },

  async applyOne(displayName) {
    const { design } = get();
    if (!design || get().applyingSheet) return;
    set({ applyingSheet: keyOf(displayName), error: null });
    try {
      const res = await apiApplySheet(design, displayName);
      set((s) => ({
        applyingSheet: null,
        applied: { ...s.applied, [keyOf(displayName)]: res.model_id },
        messages: [...s.messages, { id: uid(), role: 'assistant', content: summarize(res) }],
      }));
    } catch (e) {
      set({ applyingSheet: null, error: e instanceof Error ? e.message : 'Failed to save datasheet.' });
    }
  },

  async applyEverything(onDone) {
    const { design } = get();
    if (!design || get().busyAll) return;
    set({ busyAll: true, error: null });
    try {
      const res = await apiApplyAll(design);
      const applied: Record<string, number> = {};
      res.results.forEach((c) => {
        applied[keyOf(c.display_name)] = c.model_id;
      });
      const createdCount = res.results.filter((r) => r.is_new).length;
      const updatedCount = res.results.length - createdCount;
      const summary =
        `✅ Applied ${res.results.length} datasheet(s)` +
        (createdCount ? ` · ${createdCount} created` : '') +
        (updatedCount ? ` · ${updatedCount} updated` : '') +
        '.';
      set((s) => ({
        busyAll: false,
        applied: { ...s.applied, ...applied },
        messages: [...s.messages, { id: uid(), role: 'assistant', content: summary }],
      }));
      onDone?.();
    } catch (e) {
      set({ busyAll: false, error: e instanceof Error ? e.message : 'Failed to apply the design.' });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

export type { SchemaDesign, DatasheetSpec, FieldSpec };
