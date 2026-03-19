'use client';

import type { DashboardMessage } from './types';
import ChatHistory from './chat-history';

interface ChatViewProps {
  messages: DashboardMessage[];
  isLoading: boolean;
  onLoadDemo?: () => void;
  /** Passed to ChatMessage so slot forms / confirm buttons can trigger sends */
  onSend?: (message: string) => void;
}

export default function ChatView({ messages, isLoading, onLoadDemo, onSend }: ChatViewProps) {
  if (messages.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
          <h3 className="mb-1 text-lg font-semibold text-text-primary">AI Manager</h3>
          <p>
            Create work, assign tasks, add leads, schedule appointments — just by typing.
            You can also ask questions like &ldquo;show my leads&rdquo; or &ldquo;how many orders today&rdquo;.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              'assign delivery work to John',
              'show my work',
              'add a new lead',
              'show team members',
              'how many orders today',
            ].map((tip) => (
              <button
                key={tip}
                onClick={() => onSend?.(tip)}
                className="rounded-full border border-border-color bg-bg-secondary px-3 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                {tip}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4">
          <p className="max-w-md text-center text-base text-text-secondary">
            Type a message below to get started.
          </p>
          {onLoadDemo && (
            <button
              type="button"
              onClick={onLoadDemo}
              disabled={isLoading}
              className="rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
            >
              View UI demo
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ChatHistory messages={messages} onSend={onSend} disabled={isLoading} />
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-secondary pl-1">
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
          </span>
          AI Manager is working...
        </div>
      )}
    </div>
  );
}
