'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';

interface Props {
  module: 'agents' | 'lms';
  children: ReactNode;
}

export default function ModuleGuard({ module, children }: Props) {
  const user = useAuthStore((s) => s.user as any);
  const business = user?.businesses?.[0];
  const agentsEnabled = business?.agents_enabled !== false;
  const lmsEnabled = business?.lms_enabled !== false;

  const required = module === 'agents' ? agentsEnabled : lmsEnabled;
  const moduleLabel = module === 'agents' ? 'Business Agents' : 'Lead Management System';
  const copy =
    module === 'agents'
      ? 'Business Agents is an add-on. Contact your reseller to enable.'
      : 'Lead Management System is not enabled. Contact your reseller.';

  if (required) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full rounded-lg border border-border-color bg-card-bg p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border-color bg-bg-secondary text-2xl text-text-secondary">
          🔒
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{moduleLabel} is not enabled</h2>
        <p className="text-sm text-text-secondary mb-6">{copy}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-soft transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
