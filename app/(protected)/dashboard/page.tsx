import { Suspense } from 'react';
import DashboardClient from './dashboard-client';
import DashboardSkeleton from './dashboard-skeleton';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
