'use client';

import { Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import BusinessOnboardingForm from '@/components/business-onboarding-form';
import OnboardingShell from '@/components/onboarding/onboarding-shell';
import { getStatus } from '@/services/onboarding';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary text-text-secondary">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/**
 * P5 replaces the old onboarding wizard with the conductor shell — but a
 * Business row must exist first (the conductor's interview needs a business
 * to write the profile onto). So: no business yet -> the (unchanged) business
 * creation form; business exists -> the conductor.
 */
function OnboardingRouter() {
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  useEffect(() => {
    getStatus()
      .then(() => setHasBusiness(true))
      .catch(() => setHasBusiness(false));
  }, []);

  if (hasBusiness === null) return <LoadingScreen />;
  if (!hasBusiness) {
    return (
      <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center px-4 py-10 md:py-16">
        <BusinessOnboardingForm />
      </div>
    );
  }
  return <OnboardingShell />;
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
