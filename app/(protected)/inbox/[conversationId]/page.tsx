'use client';

import { useParams } from 'next/navigation';
import { ConversationsView } from '../page';

export default function ConversationByIdPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params?.conversationId;

  return <ConversationsView initialConversationId={conversationId} />;
}
