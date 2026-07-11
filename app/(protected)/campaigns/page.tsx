import { Suspense } from 'react';
import CampaignsHub from './campaigns-hub';

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-text-secondary">Loading campaigns…</div>}>
      <CampaignsHub />
    </Suspense>
  );
}
