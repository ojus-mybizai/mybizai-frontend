import { useEffect, useRef } from 'react';
import type { DashboardMessage } from './types';
import ChatMessage from './chat-message';

interface ChatHistoryProps {
  messages: DashboardMessage[];
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1 space-y-3 pb-8">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
