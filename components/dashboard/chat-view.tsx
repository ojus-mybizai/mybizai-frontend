import type { DashboardMessage } from './types';
import ChatHistory from './chat-history';

interface ChatViewProps {
  messages: DashboardMessage[];
  isLoading: boolean;
}

export default function ChatView({ messages, isLoading }: ChatViewProps) {
  if (messages.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
          <h3 className="mb-1 text-lg font-semibold text-text-primary">AI Assistant</h3>
          <p>
            Ask about work, team, leads, orders, and more. Type @ to scope (e.g. @work, @employees, @leads).
            You can attach images or documents.
          </p>
        </div>
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="max-w-md space-y-2 text-center">
            <p className="text-base text-text-secondary">
              Type a message below to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ChatHistory messages={messages} />
      {isLoading && (
        <div className="text-sm text-text-secondary">Assistant is thinking...</div>
      )}
    </div>
  );
}
