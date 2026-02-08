'use client';

interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-40 w-full animate-pulse rounded-2xl border border-border-color bg-linear-to-r from-bg-secondary via-bg-primary to-bg-secondary"
        />
      ))}
    </div>
  );
}
