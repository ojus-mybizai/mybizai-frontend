'use client';

/**
 * AI audience builder chat panel.
 *
 * The user types a natural-language description of who they want to target.
 * The AI (Azure OpenAI with tool calling) asks clarifying questions, looks up
 * pipeline stages, previews counts, and finally commits an AudienceFilter +
 * suggested segment name. When committed, onCommit is called so the parent
 * wizard can switch into 'AI filter' audience mode and show the count.
 */

import { useEffect, useRef, useState } from 'react';
import {
  aiAudienceTurn,
  type AIAudienceTurnResponse,
  type AITurnMessage,
  type AudienceFilter,
} from '@/services/outbound';

interface Props {
  onCommit: (filter: AudienceFilter, count: number, suggestedName: string) => void;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  trace?: AIAudienceTurnResponse['trace'];
}

export function AIAudienceChat({ onCommit }: Props) {
  const [transcript, setTranscript] = useState<AITurnMessage[]>([]);
  const [display, setDisplay] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content:
        'Tell me who you want to reach. For example: "Customers who asked about pricing but haven\'t booked", or "High-priority leads we haven\'t messaged for 14 days".',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committedName, setCommittedName] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [display, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setDisplay((d) => [...d, { role: 'user', content: text }]);
    setInput('');

    const nextTranscript: AITurnMessage[] = [
      ...transcript,
      { role: 'user', content: text },
    ];

    setBusy(true);
    try {
      const res = await aiAudienceTurn(nextTranscript);
      setTranscript(res.messages);
      setDisplay((d) => [
        ...d,
        { role: 'assistant', content: res.reply, trace: res.trace },
      ]);

      if (res.committed_filter && typeof res.committed_count === 'number') {
        // Extract suggested name from trace if present
        const commitTrace = res.trace.find((t) => t.tool === 'commit_filter');
        const suggestedName =
          (commitTrace?.result as { suggested_name?: string })?.suggested_name ??
          'AI segment';
        setCommittedName(suggestedName);
        onCommit(res.committed_filter, res.committed_count, suggestedName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-neutral-950"
      >
        {display.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800'
              }`}
            >
              {m.content || <em className="opacity-60">(thinking)</em>}
              {m.trace && m.trace.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-neutral-800 space-y-1">
                  {m.trace.map((t, ti) => (
                    <div key={ti} className="text-xs opacity-70 font-mono">
                      🔧 {t.tool}
                      {t.tool === 'preview_filter' && (
                        <>
                          {' → '}
                          <span className="font-semibold">
                            {(t.result as { count?: number }).count ?? 0} leads
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Committed banner */}
      {committedName && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-200">
          ✓ Audience ready: <strong>{committedName}</strong>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Describe your audience…"
          disabled={busy}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
