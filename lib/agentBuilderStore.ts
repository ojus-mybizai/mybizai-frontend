/**
 * Zustand store for the AI Agent Builder conversation.
 *
 * Manages the full builder session: messages, blueprint, stage, and loading state.
 * Optimistically appends user messages before the API responds.
 */
import { create } from 'zustand'
import {
  agentBuilderService,
  type Blueprint,
  type BuilderMessage,
  type DiscoveryChecklist,
  type DiscoveryProgress,
  type InstructionPreviewItem,
  type InstructionsQuality,
} from '@/services/agentBuilder'

export type BuilderStage =
  | 'idle'
  | 'discovery'
  | 'analysis'
  | 'proposal'
  | 'refinement'
  | 'build'
  | 'complete'

interface AgentBuilderState {
  sessionId: string | null
  stage: BuilderStage
  messages: BuilderMessage[]
  blueprint: Blueprint | null
  builtAgents: { id: number; name: string }[]
  isThinking: boolean
  error: string | null

  // Phase-5 ─────────────────────────────────────────────
  discovery: DiscoveryChecklist | null
  discoveryProgress: DiscoveryProgress | null
  previewItems: InstructionPreviewItem[]
  previewOverallQuality: InstructionsQuality | null
  isPreviewing: boolean
  // Drawer open/close lives in the store so ChatPanel + BlueprintPanel
  // can both trigger it without prop-drilling.
  isPreviewDrawerOpen: boolean

  startSession: () => Promise<void>
  sendMessage: (text: string) => Promise<void>
  approveBlueprint: () => Promise<void>
  rejectAgent: (agentIndex: number) => Promise<void>
  resetSession: () => Promise<void>
  clearError: () => void

  // Phase-5 actions
  previewInstructions: () => Promise<void>
  clearPreview: () => void
  openPreviewDrawer: () => void
  closePreviewDrawer: () => void
}

export const useAgentBuilderStore = create<AgentBuilderState>((set, get) => ({
  sessionId: null,
  stage: 'idle',
  messages: [],
  blueprint: null,
  builtAgents: [],
  isThinking: false,
  error: null,
  discovery: null,
  discoveryProgress: null,
  previewItems: [],
  previewOverallQuality: null,
  isPreviewing: false,
  isPreviewDrawerOpen: false,

  startSession: async () => {
    set({ isThinking: true, error: null })
    try {
      const res = await agentBuilderService.startSession()
      set({
        sessionId: res.sessionId,
        stage: res.stage as BuilderStage,
        isThinking: false,
        messages: [
          {
            role: 'assistant',
            content: res.message,
            timestamp: new Date().toISOString(),
          },
        ],
        blueprint: null,
        builtAgents: [],
      })
    } catch (e) {
      set({ error: (e as Error).message, isThinking: false })
    }
  },

  sendMessage: async (text: string) => {
    const { sessionId } = get()
    if (!sessionId) return

    // Optimistic: show user message immediately
    const userMsg: BuilderMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    set((s) => ({ isThinking: true, messages: [...s.messages, userMsg] }))

    try {
      const res = await agentBuilderService.sendMessage(sessionId, text)
      set((s) => ({
        isThinking: false,
        stage: res.stage as BuilderStage,
        blueprint: res.blueprint ?? s.blueprint,
        // Phase-5 — sync the live discovery snapshot from each turn so the
        // side panel re-renders without an extra round-trip.
        discovery: res.discovery ?? s.discovery,
        discoveryProgress: res.discoveryProgress ?? s.discoveryProgress,
        // Any blueprint change invalidates a stale preview — force a re-run
        previewItems: res.blueprint ? [] : s.previewItems,
        previewOverallQuality: res.blueprint ? null : s.previewOverallQuality,
        messages: [
          ...s.messages,
          {
            role: 'assistant' as const,
            content: res.message,
            timestamp: new Date().toISOString(),
          },
        ],
      }))
    } catch (e) {
      set({ error: (e as Error).message, isThinking: false })
    }
  },

  approveBlueprint: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isThinking: true, error: null })
    try {
      const res = await agentBuilderService.approve(sessionId)
      set((s) => ({
        isThinking: false,
        stage: 'complete',
        builtAgents: res.builtAgents,
        messages: [
          ...s.messages,
          {
            role: 'assistant' as const,
            content: res.message,
            timestamp: new Date().toISOString(),
          },
        ],
      }))
    } catch (e) {
      set({ error: (e as Error).message, isThinking: false })
    }
  },

  rejectAgent: async (agentIndex: number) => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isThinking: true, error: null })
    try {
      const res = await agentBuilderService.rejectAgent(sessionId, agentIndex)
      set((s) => ({
        isThinking: false,
        stage: res.stage as BuilderStage,
        blueprint: res.blueprint ?? s.blueprint,
        discovery: res.discovery ?? s.discovery,
        discoveryProgress: res.discoveryProgress ?? s.discoveryProgress,
        // Removing an agent invalidates any prior preview
        previewItems: [],
        previewOverallQuality: null,
        messages: [
          ...s.messages,
          {
            role: 'assistant' as const,
            content: res.message,
            timestamp: new Date().toISOString(),
          },
        ],
      }))
    } catch (e) {
      set({ error: (e as Error).message, isThinking: false })
    }
  },

  resetSession: async () => {
    const { sessionId } = get()
    set({
      sessionId: null,
      stage: 'idle',
      messages: [],
      blueprint: null,
      builtAgents: [],
      isThinking: false,
      error: null,
      discovery: null,
      discoveryProgress: null,
      previewItems: [],
      previewOverallQuality: null,
      isPreviewing: false,
      isPreviewDrawerOpen: false,
    })
    if (sessionId) {
      try {
        const res = await agentBuilderService.resetSession(sessionId)
        set({
          sessionId: res.sessionId,
          stage: res.stage as BuilderStage,
          isThinking: false,
          messages: [
            {
              role: 'assistant',
              content: res.message,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      } catch {
        // Fall through — start a fresh session
        get().startSession()
      }
    } else {
      get().startSession()
    }
  },

  clearError: () => set({ error: null }),

  // ── Phase-5 actions ────────────────────────────────────────

  previewInstructions: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isPreviewing: true, error: null })
    try {
      const res = await agentBuilderService.previewInstructions(sessionId)
      set({
        isPreviewing: false,
        previewItems: res.items,
        previewOverallQuality: res.overallQuality,
      })
    } catch (e) {
      set({ error: (e as Error).message, isPreviewing: false })
    }
  },

  clearPreview: () =>
    set({ previewItems: [], previewOverallQuality: null }),

  openPreviewDrawer: () => set({ isPreviewDrawerOpen: true }),
  closePreviewDrawer: () => set({ isPreviewDrawerOpen: false }),
}))
