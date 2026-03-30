import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Conversations' };

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
