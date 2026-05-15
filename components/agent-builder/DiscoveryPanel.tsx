'use client'

/**
 * DiscoveryPanel — Phase-5 live checklist showing what the architect has
 * learned so far from the owner. Mirrors the [x]/[ ] block the architect
 * itself sees in its system prompt (see _render_discovery in
 * backend/app/modules/agent_builder/prompts/architect_system.py).
 *
 * Hidden until the first turn populates discoveryProgress (i.e. while
 * the session is still loading). Collapses on small screens.
 */
import { useShallow } from 'zustand/react/shallow'
import { CheckCircle2, Circle, ListChecks } from 'lucide-react'
import { useAgentBuilderStore } from '@/lib/agentBuilderStore'

interface Props {
  className?: string
}

interface ChecklistRow {
  key: string
  label: string
  filled: boolean
  value?: string
}

export default function DiscoveryPanel({ className = '' }: Props) {
  const { discovery, discoveryProgress, stage } = useAgentBuilderStore(
    useShallow((s) => ({
      discovery: s.discovery,
      discoveryProgress: s.discoveryProgress,
      stage: s.stage,
    })),
  )

  // Hide entirely once the proposal is approved + built
  if (stage === 'complete') return null

  // Wait for first architect reply before showing anything
  if (!discoveryProgress) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="px-5 py-3 border-b border-border-color">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-text-secondary" />
            Discovery
          </p>
        </div>
        <div className="flex-1 px-5 py-6 text-xs text-text-secondary">
          The architect will fill this checklist as you chat.
        </div>
      </div>
    )
  }

  const rows: ChecklistRow[] = [
    {
      key: 'primary_goal',
      label: 'What to automate',
      filled: !!discovery?.primaryGoal,
      value: discovery?.primaryGoal ?? undefined,
    },
    {
      key: 'audience',
      label: 'Who it talks to',
      filled: !!discovery?.audience,
      value: discovery?.audience ?? undefined,
    },
    {
      key: 'autonomy',
      label: 'Autonomy level',
      filled: !!discovery?.autonomy,
      value: discovery?.autonomy ?? undefined,
    },
    {
      key: 'top_failure_modes',
      label: 'Top failure modes (≥3)',
      filled: (discovery?.topFailureModes?.length ?? 0) >= 3,
      value: discovery?.topFailureModes?.length
        ? `${discovery.topFailureModes.length} listed`
        : undefined,
    },
    {
      key: 'escalation_triggers',
      label: 'Escalation triggers (≥1)',
      filled: (discovery?.escalationTriggers?.length ?? 0) >= 1,
      value: discovery?.escalationTriggers?.length
        ? `${discovery.escalationTriggers.length} listed`
        : undefined,
    },
    {
      key: 'success_metric',
      label: 'Success metric',
      filled: !!discovery?.successMetric,
      value: discovery?.successMetric ?? undefined,
    },
    {
      key: 'available_data_sources',
      label: 'Data sources to use',
      filled: (discovery?.availableDataSources?.length ?? 0) >= 1,
      value: discovery?.availableDataSources?.length
        ? discovery.availableDataSources.join(', ')
        : undefined,
    },
  ]

  const pct = Math.round((discoveryProgress.filled / discoveryProgress.total) * 100)
  const ready = discoveryProgress.readyToPropose

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="px-5 py-3 border-b border-border-color shrink-0">
        <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-text-secondary" />
          Discovery
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
            <div
              className={`h-full transition-all ${
                ready ? 'bg-emerald-500' : 'bg-accent'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-text-secondary tabular-nums">
            {discoveryProgress.filled}/{discoveryProgress.total}
          </span>
        </div>
        <p
          className={`mt-1.5 text-[11px] ${
            ready ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-text-secondary'
          }`}
        >
          {ready
            ? 'Ready to propose — the architect can suggest agents now.'
            : `Still gathering info. Answer the architect's next question to continue.`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {rows.map((row) => (
          <DiscoveryRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  )
}

function DiscoveryRow({ row }: { row: ChecklistRow }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 transition ${
        row.filled
          ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
          : 'border-border-color bg-bg-primary'
      }`}
    >
      <div className="flex items-start gap-2">
        {row.filled ? (
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <Circle className="w-3.5 h-3.5 mt-0.5 text-text-secondary/50 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary">{row.label}</p>
          {row.value && (
            <p className="mt-0.5 text-[11px] text-text-secondary line-clamp-2">
              {row.value}
            </p>
          )}
          {!row.value && !row.filled && (
            <p className="mt-0.5 text-[11px] text-text-secondary/60 italic">
              not yet answered
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
