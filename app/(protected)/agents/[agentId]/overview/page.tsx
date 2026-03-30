import { Suspense } from 'react';
import AgentOverviewClient from './overview-client';
import { RouteLoading } from '@/components/route-loading';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentOverviewPage({ params }: PageProps) {
  const { agentId } = await params;

  return (
    <Suspense fallback={<RouteLoading />}>
      <AgentOverviewClient />
    </Suspense>
  );
}
