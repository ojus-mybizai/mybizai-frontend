'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Inbox" error={error} reset={reset} />;
}
