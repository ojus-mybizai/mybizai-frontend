import { Suspense } from 'react';
import { RouteLoading } from '@/components/route-loading';
import ChatSettingsClient from './chat-client';

export default function ChatSettingsPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <ChatSettingsClient />
    </Suspense>
  );
}
