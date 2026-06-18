'use client';

import { FormEvent, MouseEvent, useEffect, useRef, useState, useCallback } from 'react';
import { ChatBubble } from '@/components/agents/chat-bubble';
import { EmptyState } from '@/components/agents/empty-state';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { testAgent, type TestToolCall } from '@/services/agents';

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: TestToolCall[];
}

export default function AgentTestPage() {
  const { current } = useAgentStore(useShallow((s) => ({ current: s.current })));
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Stable session ID for this conversation — new ID on mount and on clear
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const resetSession = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  const SUGGESTIONS: string[] = [
    'Hi, can you help me?',
    'What do you offer?',
    'I need more information.',
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  const clearConversation = () => {
    setMessages([]);
    setError(null);
    resetSession();
  };

  const handleSuggestionClick = async (e: MouseEvent<HTMLButtonElement>, suggestion: string) => {
    e.preventDefault();
    if (isTyping) return;
    setInput(suggestion);
    await handleSendInternal(suggestion);
  };

  const handleSendInternal = async (text: string) => {
    if (!current) return;
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    setError(null);

    const userMsg: TestMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const { response, toolCalls } = await testAgent(String(current.id), trimmed, sessionIdRef.current);
      const reply: TestMessage = { id: crypto.randomUUID(), role: 'assistant', content: response, toolCalls };
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setError((err as Error).message || 'Failed to test agent');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;
    setInput('');
    await handleSendInternal(trimmed);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-color bg-card-bg p-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-text-secondary">
          Chat with <span className="font-semibold text-text-primary">{current.name}</span> to see how it responds.
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            className="text-xs font-semibold text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
          >
            Clear conversation
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border-color bg-bg-primary px-3 py-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => void handleSuggestionClick(e, s)}
              className="rounded-full border border-border-color bg-card-bg px-3 py-1 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1.5">
            <ChatBubble role={msg.role} content={msg.content} />
            {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1 pl-1">
                {msg.toolCalls.map((tc, i) => (
                  <ToolCallChip key={i} call={tc} />
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && <div className="text-xs text-text-secondary">Assistant is typing…</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function ToolCallChip({ call }: { call: TestToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-2.5 py-1.5 text-[11px] dark:border-amber-800/40 dark:bg-amber-900/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-amber-800 dark:text-amber-300"
      >
        <span>🔧</span>
        <code className="font-semibold">{call.skill}</code>
        {call.mocked && (
          <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-800/40 dark:text-amber-200">
            mocked
          </span>
        )}
        <span className="ml-auto text-amber-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="mt-1.5 overflow-x-auto rounded bg-amber-100/60 p-2 text-[10px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {JSON.stringify(call.args, null, 2)}
        </pre>
      )}
    </div>
  );
}
