'use client'

/**
 * InstructionPreviewDrawer — Phase-5
 *
 * Right-side slide-over that shows the AI-generated instructions for every
 * proposed agent BEFORE the owner clicks Approve. Each item has:
 *   - The full markdown the AI will be told
 *   - A quality flag (ok / needs_review) with the validation issue list
 *   - An "Approve & Build" CTA inside the drawer footer
 *
 * The previews are persisted on the server (session.previewed_instructions),
 * so the subsequent /approve call uses the EXACT text shown here — no
 * surprise re-generation.
 */
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  X, Loader2, AlertTriangle, CheckCircle2, Sparkles, RefreshCw,
} from 'lucide-react'
import { useAgentBuilderStore } from '@/lib/agentBuilderStore'

// Props are no longer needed — open/close lives in the store so the drawer
// can be triggered from any component (ChatPanel inline CTA, BlueprintPanel
// footer button, etc.) without prop drilling.
export default function InstructionPreviewDrawer() {
  const {
    open,
    closeDrawer: onClose,
    previewItems,
    previewOverallQuality,
    isPreviewing,
    isThinking,
    previewInstructions,
    approveBlueprint,
    error,
  } = useAgentBuilderStore(
    useShallow((s) => ({
      open: s.isPreviewDrawerOpen,
      closeDrawer: s.closePreviewDrawer,
      previewItems: s.previewItems,
      previewOverallQuality: s.previewOverallQuality,
      isPreviewing: s.isPreviewing,
      isThinking: s.isThinking,
      previewInstructions: s.previewInstructions,
      approveBlueprint: s.approveBlueprint,
      error: s.error,
    })),
  )

  // Auto-trigger preview generation the first time the drawer is opened
  // (or whenever it's opened with empty previewItems). The server caches
  // results on the session so this is idempotent.
  useEffect(() => {
    if (open && previewItems.length === 0 && !isPreviewing) {
      void previewInstructions()
    }
  }, [open, previewItems.length, isPreviewing, previewInstructions])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleApprove = async () => {
    await approveBlueprint()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="flex-1 bg-black/30 backdrop-blur-sm"
      />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-card-bg border-l border-border-color flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border-color flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Preview AI Instructions
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              These are the exact instructions the AI will be told to follow.
              Review before building.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isPreviewing && previewItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-sm text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Generating instructions for each agent…</span>
              <span className="text-[11px] text-text-secondary/70">
                This usually takes 5–15 seconds per agent.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300/60 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20 px-3 py-2 text-xs text-red-900 dark:text-red-200">
              {error}
            </div>
          )}

          {previewOverallQuality === 'needs_review' && previewItems.length > 0 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                One or more agents have instructions that need review. You can
                still approve, but the agent's overview page will show a banner
                asking you to edit them.
              </div>
            </div>
          )}

          {previewItems.map((item) => (
            <PreviewCard key={item.agentIndex} item={item} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-color shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void previewInstructions()}
            disabled={isPreviewing || isThinking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPreviewing ? 'animate-spin' : ''}`} />
            Regenerate
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:bg-bg-secondary"
            >
              Back to chat
            </button>
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={
                isThinking || isPreviewing || previewItems.length === 0
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-40"
            >
              {isThinking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Approve &amp; Build
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Per-agent preview card ────────────────────────────────────

interface CardProps {
  item: {
    agentIndex: number
    agentName: string
    instructions: string
    quality: 'ok' | 'needs_review'
    issues: string[]
  }
}

function PreviewCard({ item }: CardProps) {
  const [expanded, setExpanded] = useState(true)
  const isOk = item.quality === 'ok'

  return (
    <div className="rounded-xl border border-border-color bg-bg-primary overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-secondary"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isOk ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="text-sm font-semibold text-text-primary truncate">
            {item.agentName}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
              isOk
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}
          >
            {isOk ? 'OK' : 'Needs review'}
          </span>
        </div>
        <span className="text-[11px] text-text-secondary shrink-0">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border-color space-y-3 bg-bg-primary">
          {item.issues.length > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300/60 dark:border-amber-800/40 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Validation issues:
              </p>
              <ul className="space-y-0.5">
                {item.issues.map((iss, i) => (
                  <li key={i} className="text-[11px] text-amber-800 dark:text-amber-300">
                    • {iss}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <pre className="text-[11px] leading-snug text-text-primary whitespace-pre-wrap font-mono bg-bg-secondary/40 rounded-md p-3 max-h-[400px] overflow-y-auto">
            {item.instructions || '(empty — generation failed)'}
          </pre>
        </div>
      )}
    </div>
  )
}
