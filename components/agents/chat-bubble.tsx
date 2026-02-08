'use client';

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'bg-accent text-white'
            : role === 'assistant'
            ? 'bg-card-bg border border-border-color text-text-primary'
            : 'bg-slate-100 text-slate-700'
        }`}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
