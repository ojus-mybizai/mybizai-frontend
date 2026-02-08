'use client';

import { useEffect } from 'react';
import { redirect, useParams, useRouter } from 'next/navigation';

export default function AgentRedirectPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params?.agentId) {
      router.replace(`/agents/${params.agentId}/overview`);
    }
  }, [params?.agentId, router]);

  if (params?.agentId) {
    // Next.js requires either redirect or render; redirect helper can't use hooks, so do nothing while effect runs.
    return null;
  }

  redirect('/agents');
}
