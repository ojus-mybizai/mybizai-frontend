import { Suspense } from 'react';
import LeadDetailClient from './lead-detail-client';
import { RouteLoading } from '@/components/route-loading';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<RouteLoading />}>
      <LeadDetailClient leadId={id} />
    </Suspense>
  );
}
