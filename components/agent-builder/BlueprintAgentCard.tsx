'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, Zap, Clock, MessageSquare } from 'lucide-react'
import type { BlueprintAgent } from '@/services/agentBuilder'

interface Props {
  agent: BlueprintAgent
  onRemove: () => void
  disabled?: boolean
}

const ROLE_COLORS: Record<string, string> = {
  sales: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  support: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  general: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  lead: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Proposed', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Removed', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  built:    { label: 'Live', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
}

function TriggerIcon({ triggers }: { triggers: Record<string, unknown>[] }) {
  const hasSchedule = triggers.some((t) => t.type === 'schedule')
  const hasEvent = triggers.some((t) => t.type === 'event')
  if (hasSchedule) return <Clock className="w-3 h-3" />
  if (hasEvent) return <Zap className="w-3 h-3" />
  return <MessageSquare className="w-3 h-3" />
}

export default function BlueprintAgentCard({ agent, onRemove, disabled }: Props) {
  const [expanded, setExpanded] = useState(false)

  const roleColor = ROLE_COLORS[agent.roleType] || ROLE_COLORS.general
  const statusBadge = STATUS_BADGE[agent.status] || STATUS_BADGE.proposed
  const isBuilt = agent.status === 'built'
  const isRejected = agent.status === 'rejected'

  return (
    <div
      className={`rounded-xl border transition-all ${
        isRejected
          ? 'border-border-color bg-bg-secondary opacity-50'
          : 'border-border-color bg-card-bg hover:border-accent/30'
      }`}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 text-sm font-bold text-accent">
          {agent.personaName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary">{agent.personaName}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleColor}`}>
              {agent.roleType}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{agent.description}</p>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-secondary">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <TriggerIcon triggers={agent.triggers} />
              {agent.triggers.length > 0
                ? `${agent.triggers.length} trigger${agent.triggers.length !== 1 ? 's' : ''}`
                : 'Chat only'}
            </span>
            {agent.estimatedMonthlyRuns > 0 && (
              <span>~{agent.estimatedMonthlyRuns}/mo</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isBuilt && !isRejected && (
            <button
              onClick={onRemove}
              disabled={disabled}
              title="Remove agent"
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border-color mt-0">
          <div className="pt-3">
            <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1">Why this agent</p>
            <p className="text-xs text-text-primary leading-relaxed">{agent.why}</p>
          </div>

          {agent.skills.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1">
                {agent.skills.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-bg-secondary border border-border-color text-text-secondary"
                  >
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {agent.channelDeploy.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mb-1">Channels</p>
              <p className="text-xs text-text-primary">{agent.channelDeploy.join(', ')}</p>
            </div>
          )}

          {isBuilt && agent.builtAgentId && (
            <a
              href={`/agents/${agent.builtAgentId}/overview`}
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
            >
              View agent →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
