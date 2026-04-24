import { Suspense } from 'react';
import NurtureHubClient from './nurture-hub-client';

export default function NurturePage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-text-secondary">Loading nurture sequences…</div>}>
      <NurtureHubClient />
    </Suspense>
  );
}
