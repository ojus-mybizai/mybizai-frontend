'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bot, Send, Sparkles } from 'lucide-react';
import { useDesignerStore } from '@/lib/datasheet-designer-store';
import AskOptions from '@/components/agents/builder-chat/AskOptions';

const STARTERS = [
  'I run a catering business',
  'Track my clients and their projects',
  'Just a simple inventory sheet',
];

export default function DesignerChat() {
  const { messages, isThinking, error, sendMessage, clearError } = useDesignerStore(
    useShallow((s) => ({
      messages: s.messages,
      isThinking: s.isThinking,
      error: s.error,
      sendMessage: s.sendMessage,
      clearError: s.clearError,
    }))
  );
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  return (
    <div className="flex h-full flex-col border-r border-border-color bg-card-bg">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border-color bg-bg-secondary/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/70">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-text-primary">Datasheet Designer</div>
          <div className="text-xs text-text-secondary">Describe your business — I&apos;ll design the schema</div>
        </div>
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

            {m.role === 'assistant' && m.question && idx === messages.length - 1 && !isThinking && (
              <AskOptions question={m.question} disabled={isThinking} onAnswer={(text) => void sendMessage(text)} />
            )}
          </div>
        ))}

        {messages.length <= 1 && !isThinking && (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {STARTERS.map((s) => (
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
          <button
            type="button"
            onClick={clearError}
            className="w-full rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-left text-xs text-red-600 dark:text-red-400"
          >
            {error} — tap to dismiss
          </button>
        )}
      </div>

      {/* composer */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border-color bg-bg-secondary/30 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. add a payments sheet linked to orders"
          disabled={isThinking}
          className="flex-1 rounded-xl border border-border-color bg-card-bg px-3.5 py-2.5 text-[14px] text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isThinking || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
