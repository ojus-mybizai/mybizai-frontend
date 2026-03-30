import { Suspense } from 'react';
import LeadsClient from './leads-client';
import LeadsSkeleton from './leads-skeleton';

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsSkeleton />}>
      <LeadsClient />
    </Suspense>
  );
}
