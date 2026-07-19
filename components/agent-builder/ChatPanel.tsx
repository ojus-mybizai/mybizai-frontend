'use client'

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Send, RefreshCw, Bot, Eye } from 'lucide-react'
import { useAgentBuilderStore } from '@/lib/agentBuilderStore'

interface Props {
  className?: string
}

export default function ChatPanel({ className = '' }: Props) {
  const {
    messages, isThinking, error, stage, blueprint,
    sendMessage, resetSession, clearError, openPreviewDrawer,
  } = useAgentBuilderStore(
    useShallow((s) => ({
      messages: s.messages,
      isThinking: s.isThinking,
      error: s.error,
      stage: s.stage,
      blueprint: s.blueprint,
      sendMessage: s.sendMessage,
      resetSession: s.resetSession,
      clearError: s.clearError,
      openPreviewDrawer: s.openPreviewDrawer,
    })),
  )

  // Inline CTA shows when there's a non-empty blueprint and the conversation
  // is in a stage where building is allowed. Mirrors the BlueprintPanel's
  // canBuild check so the two never disagree. Critical on mobile where
  // BlueprintPanel is hidden — without this the AI says "tap Preview &
  // Approve" but no button is visible anywhere.
  const showInlineCta = useMemo(() => {
    if (!blueprint || !blueprint.agents) return false
    if (stage === 'complete' || stage === 'discovery' || stage === 'analysis') return false
    const active = blueprint.agents.filter((a) => a.status !== 'rejected')
    return active.length > 0 && !isThinking
  }, [blueprint, stage, isThinking])

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isThinking || stage === 'complete') return
    setInput('')
    void sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-color shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Agent Architect</p>
            <p className="text-xs text-text-secondary">AI-powered agent system designer</p>
          </div>
        </div>
        <button
          onClick={() => void resetSession()}
          title="Start over"
          className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent" />
            </div>
            <p className="text-sm text-text-secondary">Analysing your business...</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Bot className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-bg-secondary text-text-primary rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Inline Preview & Approve CTA — appears right under the AI's reply
            once a proposal is on the table. Critical on mobile (where
            BlueprintPanel is hidden by `hidden md:flex`), and a UX win on
            desktop too because the button is exactly where the user is
            reading instead of on a separate panel. */}
        {showInlineCta && (
          <div className="flex justify-start pl-9">
            <button
              onClick={openPreviewDrawer}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-sm font-semibold shadow-sm hover:bg-accent/90 transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview &amp; Approve
            </button>
          </div>
        )}

        {/* Typing indicator */}
        {isThinking && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
              <Bot className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="bg-bg-secondary rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="ml-3 text-red-400 hover:text-red-600 font-bold">×</button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border-color shrink-0">
        {stage === 'complete' ? (
          <div className="text-center text-sm text-text-secondary py-2">
            Your agent system is live.{' '}
            <button onClick={() => void resetSession()} className="text-accent hover:underline">
              Start a new session
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isThinking ? 'Architect is thinking...' : 'Type a message... (Enter to send)'}
              disabled={isThinking}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border-color bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="shrink-0 w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
