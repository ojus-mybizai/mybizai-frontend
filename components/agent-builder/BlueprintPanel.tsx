'use client'

import { useShallow } from 'zustand/react/shallow'
import { Sparkles, CheckCircle2, Clock, ExternalLink, Eye } from 'lucide-react'
import { useAgentBuilderStore } from '@/lib/agentBuilderStore'
import BlueprintAgentCard from './BlueprintAgentCard'

interface Props {
  className?: string
}

export default function BlueprintPanel({ className = '' }: Props) {
  const { blueprint, stage, builtAgents, isThinking, rejectAgent, openPreviewDrawer } =
    useAgentBuilderStore(
      useShallow((s) => ({
        blueprint: s.blueprint,
        stage: s.stage,
        builtAgents: s.builtAgents,
        isThinking: s.isThinking,
        rejectAgent: s.rejectAgent,
        openPreviewDrawer: s.openPreviewDrawer,
      })),
    )

  // ── Complete state ────────────────────────────────────────
  if (stage === 'complete' && builtAgents.length > 0) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="px-5 py-3 border-b border-border-color">
          <p className="text-sm font-semibold text-text-primary">Agent System</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">Agent System Live!</p>
            <p className="text-sm text-text-secondary mt-1">
              {builtAgents.length} agent{builtAgents.length !== 1 ? 's' : ''} created and active
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2 mt-2">
            {builtAgents.map((a) => (
              <a
                key={a.id}
                href={`/agents/${a.id}/overview`}
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl border border-border-color bg-card-bg hover:border-accent/40 hover:shadow-sm transition-all text-sm"
              >
                <span className="font-medium text-text-primary">{a.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
              </a>
            ))}
          </div>
          <a
            href="/agents"
            className="mt-2 text-sm text-accent hover:underline font-medium"
          >
            Go to Agents Dashboard →
          </a>
        </div>
      </div>
    )
  }

  // ── Empty / loading state ─────────────────────────────────
  if (!blueprint) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="px-5 py-3 border-b border-border-color">
          <p className="text-sm font-semibold text-text-primary">Proposed Agent System</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-accent/5 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-accent/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Your agent system will appear here</p>
            <p className="text-xs text-text-secondary mt-1">
              The Architect will analyse your business and design a custom system for you
            </p>
          </div>
          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Analysing your business...</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Blueprint proposal ────────────────────────────────────
  const activeAgents = blueprint.agents.filter((a) => a.status !== 'rejected')
  const canBuild = activeAgents.length > 0 && stage !== 'complete'

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-border-color shrink-0">
        <p className="text-sm font-semibold text-text-primary">Proposed Agent System</p>
        {blueprint.estimatedTimePerWeek && (
          <p className="text-xs text-text-secondary mt-0.5">
            Est. saves <span className="font-medium text-accent">{blueprint.estimatedTimePerWeek}</span>/week
          </p>
        )}
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Rationale */}
        {blueprint.rationale && (
          <div className="px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/10">
            <p className="text-xs text-text-secondary leading-relaxed">{blueprint.rationale}</p>
          </div>
        )}

        {/* Agent cards */}
        {blueprint.agents.map((agent, idx) => (
          <BlueprintAgentCard
            key={`${agent.name}-${idx}`}
            agent={agent}
            onRemove={() => void rejectAgent(agent.index)}
            disabled={isThinking}
          />
        ))}

        {/* Coverage gaps */}
        {blueprint.coverageGaps.length > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-bg-secondary border border-border-color">
            <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">
              Still manual after this system
            </p>
            <ul className="space-y-1">
              {blueprint.coverageGaps.map((gap, i) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">·</span>
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer — Preview + Approve. The drawer itself is rendered ONCE
          at the AgentBuilderClient level (so the inline CTA in the chat
          opens the same instance). */}
      <div className="px-4 py-3 border-t border-border-color shrink-0 space-y-2">
        <button
          onClick={openPreviewDrawer}
          disabled={!canBuild || isThinking}
          className="w-full py-2.5 rounded-xl border border-accent/40 bg-accent/5 text-accent text-sm font-semibold hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Preview &amp; Approve
        </button>
        {canBuild && !isThinking && (
          <p className="text-center text-[11px] text-text-secondary">
            See the exact instructions the AI will follow before creating{' '}
            {activeAgents.length} agent{activeAgents.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </div>
  )
}
