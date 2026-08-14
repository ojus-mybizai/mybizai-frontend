'use client';

function Bar({ w = '100%', h = 12 }: { w?: string | number; h?: number }) {
  return (
    <div
      className="animate-pulse rounded bg-tc-bg-card-2"
      style={{ width: typeof w === 'number' ? `${w}px` : w, height: h }}
    />
  );
}

export function MemberListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-tc-card p-2">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-tc-bg-card-2" />
          <div className="flex-1 space-y-1.5">
            <Bar w="60%" h={10} />
            <Bar w="80%" h={8} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {['Overdue', 'Today', 'Upcoming'].map((label) => (
        <div key={label}>
          <Bar w={80} h={10} />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-tc-card border border-tc-rule bg-tc-bg-card p-3"
              >
                <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-tc-bg-card-2" />
                <div className="flex-1 space-y-1.5">
                  <Bar w="70%" h={10} />
                  <Bar w="40%" h={8} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatStreamSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-[70%] space-y-1.5 rounded-tc-panel bg-tc-bg-card-2 p-3">
            <Bar w={180} h={10} />
            <Bar w={120} h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConsoleSkeleton() {
  return (
    <div className="grid h-full grid-cols-[260px_1fr] bg-tc-bg-ground">
      <aside className="border-r border-tc-rule bg-tc-bg-card">
        <div className="p-3">
          <Bar w="100%" h={32} />
        </div>
        <MemberListSkeleton />
      </aside>
      <main>
        <div className="flex items-center gap-3 border-b border-tc-rule p-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-tc-bg-card-2" />
          <div className="flex-1 space-y-1.5">
            <Bar w={140} h={12} />
            <Bar w={80} h={8} />
          </div>
        </div>
        <TaskListSkeleton />
      </main>
    </div>
  );
}
