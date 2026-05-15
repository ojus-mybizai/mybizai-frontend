'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAgentBuilderStore } from '@/lib/agentBuilderStore'
import ChatPanel from '@/components/agent-builder/ChatPanel'
import BlueprintPanel from '@/components/agent-builder/BlueprintPanel'
import DiscoveryPanel from '@/components/agent-builder/DiscoveryPanel'
import InstructionPreviewDrawer from '@/components/agent-builder/InstructionPreviewDrawer'

export default function AgentBuilderClient() {
  const { sessionId, startSession } = useAgentBuilderStore(
    useShallow((s) => ({ sessionId: s.sessionId, startSession: s.startSession })),
  )

  useEffect(() => {
    if (!sessionId) {
      void startSession()
    }
  }, [sessionId, startSession])

  // Three columns on lg+: Chat (40%) | Discovery (22%) | Blueprint (38%)
  // On md: drop the middle panel (room only for 2 columns).
  // On mobile: chat-only (BlueprintPanel hidden) — the inline "Preview &
  // Approve" CTA in ChatPanel covers the build path.
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-bg-primary">
      <ChatPanel className="w-full lg:w-[40%] border-r border-border-color" />
      <DiscoveryPanel className="hidden lg:flex lg:w-[22%] border-r border-border-color" />
      <BlueprintPanel className="hidden md:flex md:w-[45%] lg:w-[38%]" />

      {/* Single drawer instance — opened from either the inline CTA in
          ChatPanel or the footer button in BlueprintPanel via the store. */}
      <InstructionPreviewDrawer />
    </div>
  )
}
