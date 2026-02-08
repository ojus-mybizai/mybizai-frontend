import type { DashboardMessage } from './types';

interface ChatMessageProps {
  message: DashboardMessage;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-base whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-accent text-white rounded-br-sm'
            : 'bg-card-bg text-text-primary border border-border-color rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
