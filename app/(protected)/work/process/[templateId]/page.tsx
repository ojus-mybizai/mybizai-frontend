'use client';

import { useParams } from 'next/navigation';
import { ProcessSummaryView } from '@/components/work/process-summary-view';

export default function ProcessPage() {
  const params = useParams();
  const templateId = Number(params.templateId);

  if (!templateId || isNaN(templateId)) {
    return (
      <div className="mx-auto max-w-7xl p-5">
        <p className="text-text-secondary">Invalid process template.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <ProcessSummaryView templateId={templateId} />
    </div>
  );
}
