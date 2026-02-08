'use client';

import { useParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import { ConversationsView } from '../page';

export default function ConversationByIdPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params?.conversationId;

  return (
    <ProtectedShell>
      <ConversationsView initialConversationId={conversationId} />
    </ProtectedShell>
  );
}
