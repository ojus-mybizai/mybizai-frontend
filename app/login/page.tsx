'use client';

import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { broadcastAuthEvent } from '@/lib/auth-events';
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect';

interface LoginSuccessData {
  access_token: string;
  token_type: string;
  refresh_token: string | null;
  onboarding_required: boolean | null;
  default_business_id?: number | null;
  default_role?: 'owner' | 'manager' | 'executive' | null;
  has_active_business_access?: boolean;
}

interface UnverifiedUserData {
  verification_required: boolean;
  user_id: number;
  email: string;
  message: string;
}

interface LoginResult {
  success: boolean;
  data: LoginSuccessData | UnverifiedUserData;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);
  const setDefaultBusinessId = useAuthStore((s) => s.setDefaultBusinessId);
  const setDefaultRole = useAuthStore((s) => s.setDefaultRole);
  const setHasActiveBusinessAccess = useAuthStore((s) => s.setHasActiveBusinessAccess);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiFetch<LoginResult>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      if (!result.success) {
        const unverified = result.data as UnverifiedUserData;

        if (unverified.verification_required && unverified.user_id && unverified.email) {
          router.push(
            `/verify-email?user_id=${unverified.user_id}&email=${encodeURIComponent(
              unverified.email,
            )}&flow=login&next=${encodeURIComponent(next)}`,
          );
          return;
        }

        setError(unverified.message || 'Please verify your email to continue');
        return;
      }

      const data = result.data as LoginSuccessData;
      const accessToken = data.access_token || '';
      const refreshToken = data.refresh_token || '';
      const onboardingRequired = Boolean(data.onboarding_required);
      const defaultBusinessId = data.default_business_id ?? null;
      const defaultRole = data.default_role ?? null;
      const hasActiveBusinessAccess = data.has_active_business_access ?? true;

      setAccessToken(accessToken || null);
      setUser(null);
      setOnboardingRequired(onboardingRequired);
      setDefaultBusinessId(defaultBusinessId);
      setDefaultRole(defaultRole);
      setHasActiveBusinessAccess(hasActiveBusinessAccess);
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
          defaultRole,
        }),
      );
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 403) {
        setError(
          apiError.message ||
            'Your employee access is deactivated. Contact your business owner.',
        );
        return;
      }
      setError(apiError.message || 'Login failed');
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

        <h1 className="text-2xl font-semibold text-text-primary mb-2">Log in</h1>
        <p className="text-sm text-text-secondary mb-6">
          Enter your email and password to access your workspace.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 pr-16 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-xs text-text-secondary">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => router.push('/signup')}
            className="text-accent underline-offset-2 hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center">
        <span className="text-sm text-text-secondary">Loading...</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
