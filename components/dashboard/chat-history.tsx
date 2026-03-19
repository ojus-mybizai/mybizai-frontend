'use client';

import { useEffect, useRef } from 'react';
import type { DashboardMessage } from './types';
import ChatMessage from './chat-message';

interface ChatHistoryProps {
  messages: DashboardMessage[];
  onSend?: (message: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  disabled?: boolean;
}

export default function ChatHistory({ messages, onSend, onEdit, disabled }: ChatHistoryProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="space-y-1 pb-2">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onSend={onSend}
          onEdit={onEdit}
          disabled={disabled}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
