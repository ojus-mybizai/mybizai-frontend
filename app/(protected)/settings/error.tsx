'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Settings" error={error} reset={reset} />;
}
