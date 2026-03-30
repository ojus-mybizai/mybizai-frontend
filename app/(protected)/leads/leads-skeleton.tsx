export default function LeadsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-24 rounded bg-bg-secondary" />
          <div className="h-4 w-48 rounded bg-bg-secondary" />
        </div>
        <div className="h-9 w-28 rounded-md bg-bg-secondary" />
      </div>

      {/* Stats cards row */}
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card-bg p-4">
            <div className="h-3 w-20 rounded bg-bg-secondary mb-2" />
            <div className="h-6 w-12 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        <div className="h-9 w-48 rounded-md bg-bg-secondary" />
        <div className="h-9 w-32 rounded-md bg-bg-secondary" />
        <div className="h-9 w-32 rounded-md bg-bg-secondary" />
      </div>

      {/* Table rows */}
      <div className="rounded-xl border border-border bg-card-bg">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3">
            <div className="h-4 w-32 rounded bg-bg-secondary" />
            <div className="h-4 w-24 rounded bg-bg-secondary" />
            <div className="h-4 w-20 rounded bg-bg-secondary" />
            <div className="h-4 w-16 rounded bg-bg-secondary" />
            <div className="flex-1" />
            <div className="h-4 w-20 rounded bg-bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
