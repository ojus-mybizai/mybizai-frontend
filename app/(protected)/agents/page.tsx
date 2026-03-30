import { Suspense } from 'react';
import AgentsClient from './agents-client';
import AgentsSkeleton from './agents-skeleton';

export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsSkeleton />}>
      <AgentsClient />
    </Suspense>
  );
}
