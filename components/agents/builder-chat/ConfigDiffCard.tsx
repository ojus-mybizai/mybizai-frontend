'use client'

import { Check, X, AlertTriangle, Sparkles, Database, Tag } from 'lucide-react'
import type { PendingChange } from '@/lib/agent-builder-chat-store'

interface Props {
  pending: PendingChange
  busy: boolean
  onApply: () => void
  onDiscard: () => void
}

const FIELD_LABELS: Record<string, string> = {
  guardrail_rules: 'Guardrails',
  escalation_policy: 'Escalation',
  reply_format: 'Reply format',
  reply_language: 'Language',
  tone: 'Tone',
  skills: 'Skills',
  skill_overrides: 'Skill tuning',
  response_plays: 'Response plays',
  knowledge_files: 'Knowledge',
  instructions: 'Instructions',
  schedule_cron: 'Schedule',
  triggers: 'Triggers',
  channel_deploy: 'Channels',
  datasheet_grants: 'Datasheet access',
  nurture_sequence_id: 'Nurture',
  chat_enabled: 'Chat mode',
  automation_enabled: 'Automation mode',
}

function summarizeValue(v: unknown): string {
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  if (v && typeof v === 'object') return Object.keys(v as object).join(', ')
  return String(v)
}

export default function ConfigDiffCard({ pending, busy, onApply, onDiscard }: Props) {
  const patch = pending.patch || {}
  const changedKeys = Object.keys(patch).filter((k) => k !== 'provision')
  const provision = (patch.provision || {}) as Record<string, unknown>
  const newSheets = (provision.create_datasheets as unknown[]) || []
  const newFields = (provision.create_contact_fields as unknown[]) || []
  const errors = pending.issues.filter((i) => i.severity === 'error')
  const warns = pending.issues.filter((i) => i.severity === 'warn')

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-text-primary">
        <Sparkles className="h-4 w-4 text-accent" />
        Proposed change
      </div>

      {/* changed fields */}
      <ul className="space-y-1">
        {changedKeys.map((k) => (
          <li key={k} className="flex items-start gap-2 text-text-secondary">
            <span className="mt-0.5 inline-block rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-text-primary">
              {FIELD_LABELS[k] ?? k}
            </span>
            <span className="text-xs">{summarizeValue(patch[k])}</span>
          </li>
        ))}
        {changedKeys.length === 0 && !newSheets.length && !newFields.length && (
          <li className="text-xs text-text-secondary">No field changes.</li>
        )}
      </ul>

      {/* provisioning */}
      {(newSheets.length > 0 || newFields.length > 0) && (
        <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">
          <div className="mb-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Will create:
          </div>
          {newSheets.map((s, idx) => (
            <div key={`s${idx}`} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Database className="h-3 w-3" />
              Datasheet “{(s as { display_name?: string }).display_name ?? 'new'}”
            </div>
          ))}
          {newFields.map((f, idx) => (
            <div key={`f${idx}`} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Tag className="h-3 w-3" />
              Contact field “{(f as { name?: string }).name ?? 'new'}”
            </div>
          ))}
        </div>
      )}

      {/* issues */}
      {(errors.length > 0 || warns.length > 0) && (
        <ul className="mt-2 space-y-1">
          {[...errors, ...warns].map((i, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-1.5 text-[11px] ${
                i.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {/* actions */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || errors.length > 0}
          onClick={onApply}
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Apply
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDiscard}
          className="inline-flex items-center gap-1 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  )
}
