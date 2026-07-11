import { Suspense } from 'react';
import ModuleGuard from '@/components/module-guard';
import InternalChatClient from './internal-chat-client';

export default function InternalChatPage() {
  return (
    <ModuleGuard module="chat_agent">
      <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading…</div>}>
        <InternalChatClient />
      </Suspense>
    </ModuleGuard>
  );
}
