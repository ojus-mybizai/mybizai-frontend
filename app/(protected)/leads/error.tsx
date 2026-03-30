'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Leads" error={error} reset={reset} />;
}
