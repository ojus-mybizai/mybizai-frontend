/**
 * Per-agent Builder Chat store (v2 JSON-config flow).
 *
 * Owns the refine conversation + the pending proposed change for ONE agent.
 * The agent itself stays the source of truth in agent-store; after an Apply we
 * refresh it there so every tab re-renders.
 */
import { create } from 'zustand'
import {
  agentBuilderV2,
  type AgentConfig,
  type AskQuestion,
  type ConfigIssue,
  type RefineTranscript,
} from '@/services/agentBuilderV2'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  question?: AskQuestion | null   // structured options to render under an ask
}

export interface PendingChange {
  message: string
  patch: Record<string, unknown>
  merged: Record<string, unknown>
  issues: ConfigIssue[]
}

type BuilderMode = 'build' | 'refine'

interface BuilderChatState {
  agentId: number | null
  mode: BuilderMode
  isOpen: boolean
  messages: ChatMessage[]
  isThinking: boolean
  error: string | null
  pending: PendingChange | null
  // a test-tab transcript queued as context for the next message
  refTranscript: RefineTranscript | null

  setOpen(v: boolean): void
  toggleOpen(): void
  init(agentId: number): Promise<void>
  sendMessage(text: string): Promise<void>
  retryLast(): Promise<void>
  startRefineFromTranscript(t: RefineTranscript): void
  applyPending(onApplied?: (agentId: number) => void): Promise<void>
  discardPending(): void
  clearError(): void
}

const uid = () => Math.random().toString(36).slice(2)

const PANEL_OPEN_KEY = 'mybizai.builderPanelOpen'
function readOpen(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(PANEL_OPEN_KEY) !== '0'
}
function writeOpen(v: boolean) {
  if (typeof window !== 'undefined') window.localStorage.setItem(PANEL_OPEN_KEY, v ? '1' : '0')
}

const BUILD_GREETING =
  "Hey! Let’s set this agent up together. In a sentence or two — what’s the main thing " +
  "you want it to do for your business?"

const REFINE_GREETING =
  "Hi! I can adjust anything about this agent — how it talks, what it says, what it can do. " +
  "What would you like to improve?"

const PLACEHOLDER_INSTRUCTIONS = 'Describe how this agent should operate.'

function isEmptyConfig(cfg: AgentConfig): boolean {
  let instr = ((cfg?.instructions as string) || '').trim()
  if (instr === PLACEHOLDER_INSTRUCTIONS) instr = ''
  const skills = (cfg?.skills as unknown[]) || []
  return !instr && skills.length === 0
}

export const useBuilderChatStore = create<BuilderChatState>((set, get) => ({
  agentId: null,
  mode: 'refine',
  isOpen: readOpen(),
  messages: [],
  isThinking: false,
  error: null,
  pending: null,
  refTranscript: null,

  setOpen(v) {
    writeOpen(v)
    set({ isOpen: v })
  },
  toggleOpen() {
    const next = !get().isOpen
    writeOpen(next)
    set({ isOpen: next })
  },

  async init(agentId) {
    // Reset the thread when switching agents
    if (get().agentId === agentId) return
    set({
      agentId,
      mode: 'refine',
      messages: [{ id: uid(), role: 'assistant', content: REFINE_GREETING }],
      pending: null,
      error: null,
      refTranscript: null,
    })
    // Decide build-first vs refine based on whether the agent is configured yet.
    try {
      const cfg = await agentBuilderV2.getConfig(agentId)
      if (get().agentId !== agentId) return // switched away while loading
      const building = isEmptyConfig(cfg)
      set({
        mode: building ? 'build' : 'refine',
        messages: [{ id: uid(), role: 'assistant', content: building ? BUILD_GREETING : REFINE_GREETING }],
      })
    } catch {
      /* keep refine greeting on failure */
    }
  },

  startRefineFromTranscript(t) {
    set((s) => ({
      refTranscript: t,
      messages: [
        ...s.messages,
        {
          id: uid(),
          role: 'assistant',
          content: `About this reply:\n“${t.agent_reply}”\nWhat should change?`,
        },
      ],
    }))
  },

  async sendMessage(text) {
    const agentId = get().agentId
    const trimmed = text.trim()
    if (!agentId || !trimmed || get().isThinking) return

    const transcript = get().refTranscript ?? undefined
    // Send the conversation so far so the builder can converse across turns.
    const history = get().messages.map((m) => ({ role: m.role, content: m.content }))
    set((s) => ({
      messages: [...s.messages, { id: uid(), role: 'user', content: trimmed }],
      isThinking: true,
      error: null,
      refTranscript: null,
    }))

    try {
      const out = await agentBuilderV2.refine(agentId, trimmed, { transcript, history })
      const assistantMsg = out.message || (out.mode === 'propose' ? 'Here is the change I propose.' : '')
      set((s) => ({
        messages: [
          ...s.messages,
          { id: uid(), role: 'assistant', content: assistantMsg, question: out.question ?? null },
        ],
        isThinking: false,
        pending:
          out.mode === 'propose' && out.patch
            ? {
                message: out.message || '',
                patch: out.patch,
                merged: (out.merged as Record<string, unknown>) ?? {},
                issues: out.issues ?? [],
              }
            : get().pending,
      }))
    } catch (e) {
      set({ isThinking: false, error: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  },

  // Re-run the last user message (e.g. after a token-limit/parse failure) without
  // adding a duplicate bubble. History excludes that trailing user message.
  async retryLast() {
    const agentId = get().agentId
    if (!agentId || get().isThinking) return
    const msgs = get().messages
    let idx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { idx = i; break }
    }
    if (idx === -1) return
    const feedback = msgs[idx].content
    const history = msgs.slice(0, idx).map((m) => ({ role: m.role, content: m.content }))
    // Drop any failed assistant turn after the user message we're retrying.
    set({ messages: msgs.slice(0, idx + 1), isThinking: true, error: null })

    try {
      const out = await agentBuilderV2.refine(agentId, feedback, { history })
      const assistantMsg = out.message || (out.mode === 'propose' ? 'Here is the change I propose.' : '')
      set((s) => ({
        messages: [
          ...s.messages,
          { id: uid(), role: 'assistant', content: assistantMsg, question: out.question ?? null },
        ],
        isThinking: false,
        pending:
          out.mode === 'propose' && out.patch
            ? {
                message: out.message || '',
                patch: out.patch,
                merged: (out.merged as Record<string, unknown>) ?? {},
                issues: out.issues ?? [],
              }
            : get().pending,
      }))
    } catch (e) {
      set({ isThinking: false, error: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  },

  async applyPending(onApplied) {
    const { agentId, pending } = get()
    if (!agentId || !pending) return
    set({ isThinking: true, error: null })
    try {
      await agentBuilderV2.applyRefine(agentId, pending.patch)
      set((s) => ({
        isThinking: false,
        pending: null,
        messages: [
          ...s.messages,
          { id: uid(), role: 'assistant', content: '✅ Applied. Your next test message will reflect it.' },
        ],
      }))
      onApplied?.(agentId)
    } catch (e) {
      set({ isThinking: false, error: e instanceof Error ? e.message : 'Failed to apply.' })
    }
  },

  discardPending() {
    set({ pending: null })
  },

  clearError() {
    set({ error: null })
  },
}))
