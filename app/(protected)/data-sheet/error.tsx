'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function DataSheetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Data Sheet" error={error} reset={reset} />;
}
