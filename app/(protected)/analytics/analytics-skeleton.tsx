export default function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-24 rounded bg-bg-secondary" />
          <div className="h-4 w-48 rounded bg-bg-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-md bg-bg-secondary" />
          <div className="h-9 w-32 rounded-md bg-bg-secondary" />
          <div className="h-9 w-16 rounded-md bg-bg-secondary" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card-bg px-4 py-3">
            <div className="h-3 w-28 rounded bg-bg-secondary mb-2" />
            <div className="h-6 w-12 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>

      {/* Second stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card-bg px-4 py-3">
            <div className="h-3 w-28 rounded bg-bg-secondary mb-2" />
            <div className="h-6 w-12 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card-bg">
        <div className="p-4 border-b border-border">
          <div className="h-4 w-32 rounded bg-bg-secondary" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border">
            <div className="h-4 w-20 rounded bg-bg-secondary" />
            <div className="h-4 w-24 rounded bg-bg-secondary" />
            <div className="h-4 w-16 rounded bg-bg-secondary" />
            <div className="h-4 w-12 rounded bg-bg-secondary" />
            <div className="h-4 w-12 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
