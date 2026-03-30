'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function AgentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Agents" error={error} reset={reset} />;
}
