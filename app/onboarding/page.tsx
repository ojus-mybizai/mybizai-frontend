'use client';

import { Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import BusinessOnboardingForm from '@/components/business-onboarding-form';
import SystemBuilderSurface from '@/components/system-builder/SystemBuilderSurface';
import { openSession } from '@/services/system-builder';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary text-text-secondary">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/**
 * Phase 4: first-run onboarding IS the System Builder session (the old
 * conductor shell is retired). A Business row must exist first (the interview
 * writes the profile onto it), so: no business yet -> the (unchanged) business
 * creation form; business exists -> the System Builder onboarding surface, which
 * runs gate-exempt and opens the app once the profile is captured.
 */
function OnboardingRouter() {
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  useEffect(() => {
    // openSession is gate-exempt; it 404s only when the user has no business yet.
    openSession()
      .then(() => setHasBusiness(true))
      .catch((e: { status?: number }) => setHasBusiness(e?.status === 404 ? false : true));
  }, []);

  if (hasBusiness === null) return <LoadingScreen />;
  if (!hasBusiness) {
    return (
      <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center px-4 py-10 md:py-16">
        <BusinessOnboardingForm />
      </div>
    );
  }
  return (
    <div className="flex h-screen flex-col bg-bg-secondary p-4 text-text-primary">
      <SystemBuilderSurface onboarding />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<LoadingScreen />}>
        <OnboardingRouter />
      </Suspense>
    </AuthGuard>
  );
}
