'use client';

import type { Message } from '@/services/customers';

function cx(...classes: Array<boolean | string | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatMessageTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type MessageWithMeta = Message & { tool_called?: string; intent?: string };

export function MessageBubble({ message, sharp }: { message: MessageWithMeta; sharp?: boolean }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool' || message.role === 'system';

  return (
    <div className={cx('flex', isUser ? 'justify-start' : 'justify-end', !sharp && 'mb-3')}>
      <div
        className={cx(
          'max-w-xl shadow-sm',
          sharp ? 'px-2 py-2' : 'rounded-2xl px-4 py-3',
          isAssistant && 'bg-accent text-white',
          isUser && 'border border-border-color bg-card-bg text-text-primary',
          isTool && 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200',
        )}
      >
        <div className={cx('text-xs uppercase tracking-wide', isAssistant ? 'text-white/90' : 'text-text-secondary')}>
          {message.role === 'assistant' ? 'AI' : message.role === 'user' ? 'User' : 'System'}
        </div>
        <div className="whitespace-pre-wrap text-base">{message.content}</div>
        {(message.tool_called || message.intent) && (
          <div className={cx('mt-2 flex flex-wrap', sharp ? '' : 'gap-1.5')}>
            {message.tool_called && (
              <span className={cx('border px-2 py-0.5 text-xs font-medium', sharp && 'rounded-none', !sharp && 'rounded', isAssistant ? 'border-white/40 text-white/90' : 'border-border-color bg-bg-secondary/60 text-text-secondary')}>
                Used: {message.tool_called}
              </span>
            )}
            {message.intent && (
              <span className={cx('border px-2 py-0.5 text-xs font-medium', sharp && 'rounded-none', !sharp && 'rounded', isAssistant ? 'border-white/40 text-white/90' : 'border-border-color bg-bg-secondary/60 text-text-secondary')}>
                Intent: {message.intent}
              </span>
            )}
          </div>
        )}
        <div className={cx('mt-1 text-xs', isAssistant ? 'text-white/80' : 'text-text-secondary')}>{formatMessageTime(message.timestamp)}</div>
      </div>
    </div>
  );
}
