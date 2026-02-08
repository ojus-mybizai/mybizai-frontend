'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

interface Props {
  children: ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const onboardingRequired = useAuthStore((s) => s.onboardingRequired);

  useEffect(() => {
    if (!isInitialized) return;

    if (!accessToken) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
      return;
    }

    if (onboardingRequired && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [accessToken, isInitialized, onboardingRequired, pathname, router]);

  // Render children immediately so first paint is real content; redirect runs in useEffect when init completes.
  return <>{children}</>;
}
