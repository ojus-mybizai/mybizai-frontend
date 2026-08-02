'use client';

import { useEffect, useRef, useState, FormEvent, useCallback } from 'react';
import { Bot, Send, MessageSquare, User, Loader2, ChevronLeft } from 'lucide-react';
import { formatTime as fmtTime } from '@/lib/format-date';
import {
  listAgents,
  sendMessage,
  getChatHistory,
  type AgentSummary,
  type ChatMessage,
  type AgentRole,
} from '@/services/agent-chat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<AgentRole, { bg: string; text: string }> = {
  sales: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  support: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  general: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  lead: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  lead_gen: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  paused: 'bg-amber-400',
  draft: 'bg-gray-400',
  inactive: 'bg-red-400',
  archived: 'bg-gray-500',
};

function roleBadge(role: AgentRole) {
  const c = ROLE_COLORS[role] ?? ROLE_COLORS.general;
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
      {(role ?? 'general').replace('_', ' ')}
    </span>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return fmtTime(iso, '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentChatPage() {
  // --- state ---
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // mobile: when an agent is selected, show chat panel
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- load agents ---
  useEffect(() => {
    let cancelled = false;
    setLoadingAgents(true);
    listAgents()
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false);
      });
    return () => { cancelled = true; };
  }, []);

  // --- load history when agent selected ---
  const selectAgent = useCallback((agent: AgentSummary) => {
    setSelectedAgent(agent);
    setMessages([]);
    setConversationId(null);
    setMobileShowChat(true);
    setLoadingHistory(true);

    getChatHistory(agent.id)
      .then((res) => {
        setMessages(res.messages);
        setConversationId(res.conversationId);
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, []);

  // --- scroll to bottom on new messages ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // --- focus input when agent selected ---
  useEffect(() => {
    if (selectedAgent && !sending) {
      inputRef.current?.focus();
    }
  }, [selectedAgent, sending]);

  // --- send message ---
  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !selectedAgent || sending) return;

    // Optimistic: add user message immediately
    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await sendMessage(selectedAgent.id, text, conversationId ?? undefined);
      setConversationId(res.conversationId);
      // Replace all messages with server-authoritative list
      setMessages(res.messages);
    } catch {
      // On error, append a system-like error message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant' as const,
          content: 'Sorry, something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // --- handle Enter key (Shift+Enter for newline) ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // Sub-renders
  // ---------------------------------------------------------------------------

  const agentListContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Bot size={20} />
          AI Agents
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Select an agent to start chatting
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingAgents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[var(--text-muted)]" size={24} />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bot size={40} className="mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No agents found</p>
          </div>
        ) : (
          agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-color)] transition-colors
                  hover:bg-[var(--bg-secondary)]
                  ${isSelected ? 'bg-[var(--bg-secondary)] border-l-2 border-l-[var(--accent)]' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {agent.name}
                      </span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status] ?? STATUS_DOT.draft}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {roleBadge(agent.role)}
                      {agent.personaName && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate">
                          {agent.personaName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
        <MessageSquare size={28} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
        Select an agent to start chatting
      </h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm">
        Pick an AI agent from the list to begin an internal conversation. Messages are saved automatically.
      </p>
    </div>
  );

  const chatPanel = selectedAgent && (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
        {/* Mobile back button */}
        <button
          onClick={() => setMobileShowChat(false)}
          className="md:hidden p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0">
          <Bot size={18} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {selectedAgent.name}
            </span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[selectedAgent.status] ?? STATUS_DOT.draft}`} />
          </div>
          <div className="flex items-center gap-2">
            {roleBadge(selectedAgent.role)}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[var(--text-muted)]" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <p className="text-sm text-[var(--text-muted)]">
              No messages yet. Say something to get started!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={14} className="text-[var(--accent)]" />
                    </div>
                  )}
                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center flex-shrink-0 mt-1">
                      <User size={14} className="text-[var(--text-muted)]" />
                    </div>
                  )}
                  {/* Bubble */}
                  <div>
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words
                        ${isUser
                          ? 'bg-[var(--accent)] text-white rounded-br-md'
                          : 'bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-bl-md'
                        }
                      `}
                    >
                      {msg.content}
                    </div>
                    <p className={`text-[10px] text-[var(--text-muted)] mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex gap-2 max-w-[80%]">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-[var(--accent)]" />
              </div>
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)]"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)] text-sm px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]
            disabled:opacity-50 max-h-32 overflow-y-auto"
          style={{ minHeight: '40px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center
            hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  return (
    <div className="h-[calc(100vh-64px)] flex bg-[var(--bg-primary)]">
      {/* Sidebar — hidden on mobile when chat is open */}
      <div
        className={`
          w-full md:w-80 md:min-w-[280px] md:max-w-xs border-r border-[var(--border-color)]
          md:block
          ${mobileShowChat ? 'hidden' : 'block'}
        `}
      >
        {agentListContent}
      </div>

      {/* Chat panel — hidden on mobile when agent list is shown */}
      <div
        className={`
          flex-1 min-w-0
          md:block
          ${mobileShowChat ? 'block' : 'hidden md:block'}
        `}
      >
        {selectedAgent ? chatPanel : emptyState}
      </div>
    </div>
  );
}
