'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Send, Trash2, Zap, User } from 'lucide-react';
import { testLiteAgent } from '@/services/lite-agents';

interface TestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function LiteAgentTestPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: TestMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const reply = await testLiteAgent(agentId, text);
      const assistantMsg: TestMessage = { id: `a-${Date.now()}`, role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: TestMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err?.message || 'Failed to get response'}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    'Hi, what do you sell?',
    'What are your prices?',
    'Do you deliver?',
    'I need help with my order',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border-color bg-card-bg p-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Zap className="h-8 w-8 text-amber-400 mb-3" />
            <p className="text-sm text-text-secondary mb-4">Send a test message to see how your Lite Agent responds.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border-color px-3 py-1.5 text-xs text-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-brand-primary text-white'
                      : 'bg-bg-secondary text-text-primary'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="rounded-xl bg-bg-secondary px-4 py-2.5 text-sm text-text-secondary">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="rounded-lg border border-border-color p-2.5 text-text-secondary hover:text-red-500 transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <form onSubmit={handleSend} className="flex flex-1 gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a test message..."
            disabled={sending}
            className="flex-1 rounded-lg border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="rounded-lg bg-brand-primary px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
