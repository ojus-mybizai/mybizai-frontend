import { Suspense, use } from 'react';
import SequenceBuilderClient from './sequence-builder-client';

export default function SequenceBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-text-secondary">Loading sequence…</div>}>
      <SequenceBuilderClient sequenceId={Number(id)} />
    </Suspense>
  );
}
