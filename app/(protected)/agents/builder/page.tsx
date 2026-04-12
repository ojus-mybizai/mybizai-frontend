'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { aiBuildAgent, type AIBuildResponse } from '@/services/agents';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentResult?: AIBuildResponse | null;
}

/* ------------------------------------------------------------------ */
/*  Quick-suggestion chips                                             */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = [
  { label: 'Clinic receptionist', prompt: 'A clinic receptionist that books appointments and answers patient FAQ' },
  { label: 'Sales qualifier', prompt: 'A sales agent that qualifies real estate leads and schedules viewings' },
  { label: 'Support agent', prompt: 'A support agent that helps customers track orders and handle returns' },
  { label: 'Lead generator', prompt: 'A lead generation agent that captures visitor info and qualifies interest' },
];

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="shrink-0 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
          <path d="M18 14a6 6 0 0 0-12 0v4h12v-4Z" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="18" r="1" />
          <path d="M9 22h6" />
        </svg>
      </div>
      <div className="bg-card-bg border border-border-color rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-text-secondary/50 animate-[bounce_1.2s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-text-secondary/50 animate-[bounce_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="w-2 h-2 rounded-full bg-text-secondary/50 animate-[bounce_1.2s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent-created success card                                         */
/* ------------------------------------------------------------------ */

function AgentCreatedCard({ result }: { result: AIBuildResponse }) {
  return (
    <div className="mt-3 border border-green-500/30 bg-green-500/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        Agent Created
      </div>

      <div className="space-y-1.5 text-sm text-text-primary">
        {result.agent_name && (
          <div className="flex gap-2">
            <span className="text-text-secondary min-w-[60px]">Name:</span>
            <span className="font-medium">{result.agent_name}</span>
          </div>
        )}
        {result.skills_selected && result.skills_selected.length > 0 && (
          <div className="flex gap-2">
            <span className="text-text-secondary min-w-[60px]">Skills:</span>
            <div className="flex flex-wrap gap-1.5">
              {result.skills_selected.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {result.agent_id && (
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/agents/${result.agent_id}/overview`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            View Agent
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
          <Link
            href={`/agents/${result.agent_id}/test`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border-color text-text-primary text-sm font-medium hover:bg-card-bg transition-colors"
          >
            Test Chat
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function AgentBuilderPage() {
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm the AI Agent Builder. Tell me what kind of agent you want to create.\n\nFor example:\n\u2022 \"A clinic receptionist that books appointments and answers FAQ\"\n\u2022 \"A sales agent for real estate that qualifies leads\"\n\u2022 \"A support agent that helps customers track orders\"",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`; // max ~4 rows
  }, [input]);

  /* ------ Send message ------------------------------------------------ */

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build conversation history (exclude system messages)
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await aiBuildAgent(text, history);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        agentResult: result.agent_created ? result : null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  /* ------ Keyboard shortcut ------------------------------------------ */

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  /* ------ "Create Another" resets the conversation -------------------- */

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Great! Let's build another agent. Describe what kind of agent you want to create.",
      },
    ]);
    setInput('');
    textareaRef.current?.focus();
  };

  /* ------ Permission guard ------------------------------------------- */

  if (!hasPermission('manage_agents')) {
    return (
      <ModuleGuard module="lms">
        <div className="flex items-center justify-center h-[60vh] text-text-secondary">
          You do not have permission to manage agents.
        </div>
      </ModuleGuard>
    );
  }

  /* ------ Helpers ----------------------------------------------------- */

  const showSuggestions = messages.length <= 1;
  const lastAgentCreated = [...messages].reverse().find((m) => m.agentResult)?.agentResult ?? null;

  /* ------ Render ------------------------------------------------------ */

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border-color">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Agents
        </Link>
        <div className="h-4 w-px bg-border-color" />
        <h1 className="text-base font-semibold text-text-primary">AI Agent Builder</h1>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] bg-accent text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            );
          }

          // assistant / system
          return (
            <div key={msg.id} className="flex items-start gap-3 max-w-[85%]">
              <div className="shrink-0 w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                  <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
                  <path d="M18 14a6 6 0 0 0-12 0v4h12v-4Z" />
                  <circle cx="9" cy="18" r="1" />
                  <circle cx="15" cy="18" r="1" />
                  <path d="M9 22h6" />
                </svg>
              </div>
              <div className="bg-card-bg border border-border-color rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                {msg.content}
                {msg.agentResult && <AgentCreatedCard result={msg.agentResult} />}
                {msg.agentResult && (
                  <button
                    onClick={handleReset}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-dashed border-border-color text-text-secondary text-sm hover:text-text-primary hover:border-accent/40 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    Create Another
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && <TypingIndicator />}

        {/* Suggestion chips */}
        {showSuggestions && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSend(s.prompt)}
                className="px-3.5 py-2 rounded-full border border-border-color bg-card-bg text-sm text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/5 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border-color px-4 py-3">
        <div className="flex items-end gap-2 bg-card-bg border border-border-color rounded-xl px-3 py-2 focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type what you want your agent to do..."
            disabled={loading}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 outline-none leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="shrink-0 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-text-secondary/50 mt-1.5 text-center">
          Press Ctrl+Enter to send
        </p>
      </div>
    </div>
  );
}
