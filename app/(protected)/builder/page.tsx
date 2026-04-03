import { Suspense } from 'react';
import BuilderClient from './builder-client';

export const metadata = { title: 'Business Builder — MyBizAI' };

function BuilderSkeleton() {
  return (
    <div className="flex h-full animate-pulse gap-4 p-4">
      <div className="w-56 shrink-0 rounded-xl bg-bg-secondary" />
      <div className="flex-1 rounded-xl bg-bg-secondary" />
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <BuilderClient />
    </Suspense>
  );
}
