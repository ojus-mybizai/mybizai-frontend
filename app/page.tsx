'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function Home() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) return;
    if (accessToken) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [isInitialized, accessToken, router]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-color border-t-accent" />
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    </div>
  );
}
