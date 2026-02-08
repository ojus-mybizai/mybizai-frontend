'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const AuthGuard = dynamic(() => import('@/components/auth-guard'));
const AppShell = dynamic(() => import('@/components/app-shell'));

export default function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
