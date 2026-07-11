import { Suspense } from 'react';
import CampaignWizard from './campaign-wizard';

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-text-secondary">Loading wizard…</div>}>
      <CampaignWizard />
    </Suspense>
  );
}
