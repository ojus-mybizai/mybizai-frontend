import { Suspense } from 'react';
import AnalyticsClient from './analytics-client';
import AnalyticsSkeleton from './analytics-skeleton';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsClient />
    </Suspense>
  );
}
