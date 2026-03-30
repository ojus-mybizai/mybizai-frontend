'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Analytics" error={error} reset={reset} />;
}
