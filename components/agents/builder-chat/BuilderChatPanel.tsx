'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Bot, Send, Sparkles, X } from 'lucide-react'
import { useBuilderChatStore } from '@/lib/agent-builder-chat-store'
import { useAgentStore } from '@/lib/agent-store'
import ConfigDiffCard from './ConfigDiffCard'
import AskOptions from './AskOptions'

interface Props {
  agentId: number
  className?: string
}

/**
 * Persistent per-agent builder chat. Clean, readable bubbles; collapsible.
 */
export default function BuilderChatPanel({ agentId, className = '' }: Props) {
  const {
    mode, messages, isThinking, error, pending,
    init, sendMessage, retryLast, applyPending, discardPending, clearError, setOpen,
  } = useBuilderChatStore(
    useShallow((s) => ({
      mode: s.mode,
      messages: s.messages,
      isThinking: s.isThinking,
      error: s.error,
      pending: s.pending,
      init: s.init,
      sendMessage: s.sendMessage,
      retryLast: s.retryLast,
      applyPending: s.applyPending,
      discardPending: s.discardPending,
      clearError: s.clearError,
      setOpen: s.setOpen,
    })),
  )
  const select = useAgentStore((s) => s.select)

  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    init(agentId)
  }, [agentId, init])

  // Keep the chat list pinned to its newest message. Scroll the list
  // container itself (not scrollIntoView, which also scrolls the window and
  // would yank the whole page to the bottom when the panel opens).
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isThinking, pending])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input
    setInput('')
    await sendMessage(text)
  }

  const onApply = () =>
    applyPending((id) => {
      void select(String(id))
    })

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm ${className}`}>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border-color bg-bg-secondary/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/70 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[15px] font-semibold text-text-primary">
            {mode === 'build' ? 'Build with AI' : 'Edit with AI'}
          </div>
          <div className="truncate text-xs text-text-secondary">
            {mode === 'build' ? 'Describe what it should do' : 'Tell me what to change'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Close panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, idx) => (
          <div key={m.id}>
            <div className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'assistant' && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-2xl rounded-br-md bg-accent text-white'
                    : 'rounded-2xl rounded-bl-md border border-border-color bg-bg-primary text-text-primary'
                }`}
              >
                {m.content}
              </div>
            </div>

            {/* structured option chips — only under the most recent ask */}
            {m.role === 'assistant' &&
              m.question &&
              idx === messages.length - 1 &&
              !isThinking &&
              !pending && (
                <AskOptions
                  question={m.question}
                  disabled={isThinking}
                  onAnswer={(text) => void sendMessage(text)}
                />
              )}
          </div>
        ))}

        {/* Starter suggestions — only on the fresh greeting, to fill the space + guide */}
        {messages.length <= 1 && !isThinking && !pending && (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {(mode === 'build'
              ? ['It answers customer questions', 'It books appointments or demos', 'It qualifies & follows up leads']
              : ['Reply only in Hindi', 'Don’t quote prices in chat', 'Add a demo booking action']
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void sendMessage(s)}
                className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-secondary transition hover:border-accent hover:text-text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {pending && (
          <ConfigDiffCard pending={pending} busy={isThinking} onApply={onApply} onDiscard={discardPending} />
        )}

        {isThinking && (
          <div className="flex items-center gap-2 pl-9 text-text-secondary">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" />
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <p>{error}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void retryLast()}
                disabled={isThinking}
                className="rounded-lg bg-accent px-3 py-1 font-semibold text-white disabled:opacity-50"
              >
                Retry
              </button>
              <button type="button" onClick={clearError} className="rounded-lg px-2 py-1 text-text-secondary hover:text-text-primary">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Always-available retry for an unsatisfying / truncated turn */}
        {!error && !isThinking && !pending && messages.length > 1 &&
          messages[messages.length - 1].role === 'assistant' &&
          !messages[messages.length - 1].question && (
            <button
              type="button"
              onClick={() => void retryLast()}
              className="ml-9 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-accent"
            >
              ↻ Try again
            </button>
          )}
      </div>

      {/* composer */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border-color bg-bg-secondary/30 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'build' ? 'e.g. a WhatsApp agent that books demo classes' : 'e.g. don’t quote prices in chat'}
          disabled={isThinking}
          className="flex-1 rounded-xl border border-border-color bg-card-bg px-3.5 py-2.5 text-[14px] text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isThinking || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
