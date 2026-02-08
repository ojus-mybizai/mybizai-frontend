'use client';

import { Suspense } from 'react';
import AuthGuard from '@/components/auth-guard';
import BusinessOnboardingForm from '@/components/business-onboarding-form';

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center">
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      }>
        <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center px-4 py-10 md:py-16">
          <BusinessOnboardingForm />
        </div>
      </Suspense>
    </AuthGuard>
  );
}
