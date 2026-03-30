'use client';

import ErrorBoundaryUI from '@/components/error-boundary-ui';

export default function ConversationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryUI section="Conversations" error={error} reset={reset} />;
}
