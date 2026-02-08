'use client';

import { AIStatusBadge } from './ai-status-badge';
import type { Conversation } from '@/services/customers';

interface Props {
  conversations: Conversation[];
  onOpen: (id: string) => void;
  onToggle?: (id: string, status: Conversation['status']) => void;
}

export function ConversationList({ conversations, onOpen, onToggle }: Props) {
  if (!conversations.length) {
    return (
      <div className="text-base text-text-secondary">
        No conversations yet. A conversation will appear here once this customer sends or receives a message.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border-color bg-bg-primary px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-text-primary">Conversation</span>
              <AIStatusBadge mode={conv.status} />
            </div>
            <p className="mt-0.5 text-sm text-text-secondary">Agent: {conv.agentName}</p>
            <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">{conv.lastMessagePreview}</p>
            <p className="mt-0.5 text-xs text-text-secondary">Updated {new Date(conv.updatedAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpen(conv.id)}
              className="rounded-lg border border-border-color px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
            >
              Open
            </button>
            {onToggle && (
              <button
                type="button"
                onClick={() => onToggle(conv.id, conv.status === 'ai' ? 'manual' : 'ai')}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Set {conv.status === 'ai' ? 'Manual' : 'AI'} mode
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
