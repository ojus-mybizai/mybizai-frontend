import { Suspense } from 'react'
import AgentBuilderClient from './agent-builder-client'

export const metadata = { title: 'Agent Builder — MyBizAI' }

function BuilderSkeleton() {
  return (
    <div className="flex h-[calc(100vh-64px)] animate-pulse">
      <div className="w-[55%] border-r border-border-color flex flex-col p-4 gap-3">
        <div className="h-6 w-40 bg-bg-secondary rounded" />
        <div className="flex-1 bg-bg-secondary rounded-xl" />
        <div className="h-12 bg-bg-secondary rounded-xl" />
      </div>
      <div className="w-[45%] p-4 flex flex-col gap-3">
        <div className="h-6 w-48 bg-bg-secondary rounded" />
        <div className="flex-1 bg-bg-secondary rounded-xl" />
      </div>
    </div>
  )
}

export default function AgentBuilderPage() {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <AgentBuilderClient />
    </Suspense>
  )
}
