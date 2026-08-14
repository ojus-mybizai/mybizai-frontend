'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { getMemberChat, markMemberChatRead, type MemberChatMessage } from '@/services/members';

const chatKey = (memberId: number) => ['member-chat', memberId] as const;

export function ChatStream({ memberId, memberName }: { memberId: number; memberName: string }) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: chatKey(memberId),
    queryFn: () => getMemberChat(memberId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!data || data.unread_count === 0) return;
    markMemberChatRead(memberId)
      .then(() => qc.invalidateQueries({ queryKey: chatKey(memberId) }))
      .catch(() => {});
  }, [data, memberId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data?.messages.length]);

  const messages = data?.messages ?? [];

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-tc-ink-muted">
        Loading chat…
      </div>
    );
  }

  if (error) {
    const msg = error instanceof Error ? error.message : 'Could not load chat';
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tc-alert-soft">
          <MessageSquare className="h-5 w-5 text-tc-alert" />
        </div>
        <p className="text-sm font-medium text-tc-ink-2">Chat unavailable</p>
        <p className="mt-1 max-w-sm text-xs text-tc-ink-muted">{msg}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tc-bg-card-2">
          <MessageSquare className="h-5 w-5 text-tc-ink-muted" />
        </div>
        <p className="text-sm font-medium text-tc-ink-2">
          No messages with {memberName} yet
        </p>
        <p className="mt-1 max-w-sm text-xs text-tc-ink-muted">
          Send a WhatsApp message from the composer below, or assign a task to start the thread.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-3">
      <ul className="space-y-2">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ message }: { message: MemberChatMessage }) {
  const isOutbound = message.role === 'assistant' || message.role === 'tool';
  const timeLabel = useMemo(() => {
    try {
      return new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [message.timestamp]);

  if (message.role === 'tool') {
    return (
      <li className="flex justify-center">
        <div className="rounded-tc-chip border border-tc-rule bg-tc-bg-card-2 px-2 py-1 text-[11px] text-tc-ink-muted">
          {message.tool_called ? `⚙ ${message.tool_called}` : '⚙ action'}
          {message.tool_status ? ` · ${message.tool_status}` : ''}
        </div>
      </li>
    );
  }

  return (
    <li className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-tc-card px-3 py-2 text-sm ${
          isOutbound
            ? 'bg-tc-accent text-white'
            : 'bg-tc-bg-card border border-tc-rule text-tc-ink'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={`mt-1 text-[10px] ${
            isOutbound ? 'text-white/70' : 'text-tc-ink-muted'
          }`}
        >
          {timeLabel}
          {isOutbound && message.delivered ? ' · delivered' : ''}
        </div>
      </div>
    </li>
  );
}
