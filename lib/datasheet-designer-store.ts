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
  updateSheet(displayName: string, updater: (s: DatasheetSpec) => DatasheetSpec): void;
  removeSheet(displayName: string): void;
  applyOne(displayName: string): Promise<void>;
  applyEverything(onDone?: () => void): Promise<void>;
  clearError(): void;
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

  async applyOne(displayName) {
    const { design } = get();
    if (!design || get().applyingSheet) return;
    set({ applyingSheet: keyOf(displayName), error: null });
    try {
      const res = await apiApplySheet(design, displayName);
      set((s) => ({
        applyingSheet: null,
        applied: { ...s.applied, [keyOf(displayName)]: res.model_id },
        messages:
          res.skipped_relations.length > 0
            ? [
                ...s.messages,
                {
                  id: uid(),
                  role: 'assistant',
                  content: `✅ Created “${res.display_name}”. ${res.skipped_relations.length} link(s) were skipped because their target sheet isn't created yet — use “Create all” or create the target first.`,
                },
              ]
            : s.messages,
      }));
    } catch (e) {
      set({ applyingSheet: null, error: e instanceof Error ? e.message : 'Failed to create datasheet.' });
    }
  },

  async applyEverything(onDone) {
    const { design } = get();
    if (!design || get().busyAll) return;
    set({ busyAll: true, error: null });
    try {
      const res = await apiApplyAll(design);
      const applied: Record<string, number> = {};
      res.created.forEach((c) => {
        applied[keyOf(c.display_name)] = c.model_id;
      });
      set((s) => ({
        busyAll: false,
        applied: { ...s.applied, ...applied },
        messages: [
          ...s.messages,
          { id: uid(), role: 'assistant', content: `✅ Created ${res.created.length} datasheet(s) with their links.` },
        ],
      }));
      onDone?.();
    } catch (e) {
      set({ busyAll: false, error: e instanceof Error ? e.message : 'Failed to create the design.' });
    }
  },

  clearError() {
    set({ error: null });
  },
}));

export type { SchemaDesign, DatasheetSpec, FieldSpec };
