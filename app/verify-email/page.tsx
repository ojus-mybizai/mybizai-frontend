'use client';

import { Suspense } from 'react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { broadcastAuthEvent } from '@/lib/auth-events';
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect';

interface VerifyEmailResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  onboarding_required: boolean;
  default_business_id?: number | null;
  default_role?: 'owner' | 'manager' | 'executive' | null;
  has_active_business_access?: boolean;
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get('email') || '';
  const userIdParam = searchParams.get('user_id');
  const flow = searchParams.get('flow') || 'signup';
  const next = searchParams.get('next') || '/dashboard';

  const userId = userIdParam ? Number(userIdParam) : null;

  const [email] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);
  const setDefaultBusinessId = useAuthStore((s) => s.setDefaultBusinessId);
  const setDefaultRole = useAuthStore((s) => s.setDefaultRole);
  const setHasActiveBusinessAccess = useAuthStore((s) => s.setHasActiveBusinessAccess);

  useEffect(() => {
    if (!resendSeconds) return;
    const id = window.setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendSeconds]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!userId) {
      setError('Verification session is invalid. Please sign up or log in again.');
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<VerifyEmailResponse>('/auth/verify-email', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ user_id: userId, code: otp }),
      });

      const accessToken = data.access_token || '';
      const refreshToken = data.refresh_token || '';
      const onboardingRequired = Boolean(data.onboarding_required);
      const defaultBusinessId = data.default_business_id ?? null;
      const defaultRole = data.default_role ?? null;
      const hasActiveBusinessAccess = data.has_active_business_access ?? true;
      const isOwner = (data as { is_owner?: boolean }).is_owner ?? (data.default_role === 'owner');
      const permissionKeys = Array.isArray((data as { permission_keys?: string[] }).permission_keys)
        ? (data as { permission_keys: string[] }).permission_keys
        : [];

      setAccessToken(accessToken || null);
      setUser(null);
      setOnboardingRequired(onboardingRequired);
      setDefaultBusinessId(defaultBusinessId);
      setDefaultRole(defaultRole);
      setHasActiveBusinessAccess(hasActiveBusinessAccess);
      useAuthStore.getState().setIsOwner(Boolean(isOwner));
      useAuthStore.getState().setPermissionKeys(permissionKeys);
      broadcastAuthEvent('login');

      if (typeof document !== 'undefined' && refreshToken) {
        try {
          document.cookie = `refresh_token=${encodeURIComponent(refreshToken)}; path=/;`;
        } catch {
          // ignore cookie errors
        }
      }

      router.replace(
        resolvePostAuthRedirect({
          onboardingRequired,
          next,
          isOwner: Boolean(isOwner),
        }),
      );
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!userId) {
      setError('Verification session is invalid. Please sign up or log in again.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ user_id: userId }),
      });
      setResendSeconds(60);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Could not resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-md md:max-w-lg rounded-2xl border border-border-color bg-card-bg p-8 md:p-10 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-color bg-bg-primary px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              MyBizAI
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-text-primary mb-2">Verify your email</h1>
        <p className="text-sm text-text-secondary mb-6">
          We&apos;ve sent a one-time code to{' '}
          <span className="font-medium text-text-primary">{email}</span>. Enter it below to
          continue.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !otp}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
          <span>Didn&apos;t receive the code?</span>
          <button
            type="button"
            disabled={loading || resendSeconds > 0}
            onClick={handleResend}
            className="text-accent underline-offset-2 hover:underline disabled:opacity-60"
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.push(flow === 'login' ? '/login' : '/signup')}
          className="mt-4 w-full text-center text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center">
        <span className="text-sm text-text-secondary">Loading...</span>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
