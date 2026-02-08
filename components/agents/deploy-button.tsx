'use client';

import { useState } from 'react';
import type { AgentStatus } from '@/services/agents';

interface DeployButtonProps {
  status: AgentStatus;
  onChange: (next: AgentStatus) => Promise<void> | void;
}

export function DeployButton({ status, onChange }: DeployButtonProps) {
  const [loading, setLoading] = useState(false);
  const next: AgentStatus = status === 'active' ? 'paused' : 'active';

  const label = status === 'active' ? 'Pause' : 'Deploy';

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onChange(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold text-white transition ${
        status === 'active' ? 'bg-slate-600 hover:bg-slate-700' : 'bg-accent hover:opacity-90'
      } disabled:opacity-60`}
    >
      {loading ? 'Working…' : label}
    </button>
  );
}
