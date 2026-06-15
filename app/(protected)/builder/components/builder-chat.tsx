'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string) => void;
  phase: string;
}

export default function BuilderChat({ messages, isLoading, onSend, phase }: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isComplete = phase === 'complete';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-bg-secondary text-text-primary rounded-bl-sm'
              }`}
            >
              <MessageContent content={msg.content} />
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-bg-secondary px-4 py-3 rounded-bl-sm">
              <div className="flex gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:0ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:150ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-color p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isComplete
                ? 'Your system is set up! Say "start over" to rebuild.'
                : 'Type your response...'
            }
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none disabled:opacity-50"
            style={{ minHeight: '36px', maxHeight: '120px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Render message content with basic markdown (bold, newlines, bullet points). */
function MessageContent({ content }: { content: string }) {
  const parts = content.split('\n');
  return (
    <div className="space-y-1">
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Replace **bold** with <strong>
        const rendered = line.replace(
          /\*\*(.+?)\*\*/g,
          '<strong class="font-semibold">$1</strong>',
        );

        // Detect bullet points
        const isBullet = /^\s*[-*]\s/.test(line);
        const cleanLine = isBullet ? rendered.replace(/^\s*[-*]\s/, '') : rendered;

        return (
          <div key={i} className={isBullet ? 'flex gap-1.5' : ''}>
            {isBullet && <span className="text-text-secondary mt-0.5">-</span>}
            <span dangerouslySetInnerHTML={{ __html: isBullet ? cleanLine : rendered }} />
          </div>
        );
      })}
    </div>
  );
}
