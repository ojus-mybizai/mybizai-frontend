'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const AuthGuard = dynamic(() => import('@/components/auth-guard'));
const AppShell = dynamic(() => import('@/components/app-shell'));
const ToastContainer = dynamic(() => import('@/components/toast-container'));

export default function ProtectedShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
      <ToastContainer />
    </AuthGuard>
  );
}
