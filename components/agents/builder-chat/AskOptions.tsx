'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { AskQuestion } from '@/services/agentBuilderV2'

interface Props {
  question: AskQuestion
  disabled: boolean
  onAnswer: (text: string) => void
}

/**
 * Renders a builder clarifying question as selectable option chips (Claude-style).
 * Single-select sends immediately on click; multi-select toggles + a Continue button.
 */
export default function AskOptions({ question, disabled, onAnswer }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const multi = !!question.multi
  const options = question.options || []

  if (options.length === 0) return null

  const toggle = (opt: string) => {
    if (disabled) return
    if (!multi) {
      onAnswer(opt)
      return
    }
    setSelected((s) => (s.includes(opt) ? s.filter((o) => o !== opt) : [...s, opt]))
  }

  return (
    <div className="ml-8 mt-1.5 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSel = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                isSel
                  ? 'border-accent bg-accent text-white'
                  : 'border-border-color bg-card-bg text-text-secondary hover:border-accent hover:text-text-primary'
              }`}
            >
              {multi && isSel && <Check className="h-3 w-3" />}
              {opt}
            </button>
          )
        })}
      </div>

      {multi && (
        <button
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={() => onAnswer(selected.join(', '))}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Continue{selected.length ? ` (${selected.length})` : ''}
        </button>
      )}

      {question.allow_custom && (
        <p className="text-[11px] text-text-secondary">…or type your own answer below.</p>
      )}
    </div>
  )
}
