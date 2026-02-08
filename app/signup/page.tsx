'use client';

import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api-client';

interface SignupResponse {
  message: string;
  requires_verification: boolean;
  user_id: number;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch<SignupResponse>('/auth/signup', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password, username }),
      });

      const requiresVerification = Boolean(data.requires_verification);

      if (requiresVerification) {
        router.push(
          `/verify-email?user_id=${data.user_id}&email=${encodeURIComponent(
            email,
          )}&flow=signup&next=${encodeURIComponent(next)}`,
        );
        return;
      }

      // If the backend ever returns requires_verification: false, treat this
      // as a completed signup without auto-login and send the user to login.
      router.replace('/login');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Signup failed');
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

        <h1 className="text-2xl font-semibold text-text-primary mb-2">Sign up</h1>
        <p className="text-sm text-text-secondary mb-6">
          Create your account to get started.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 pr-16 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-3 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-xs text-text-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-accent underline-offset-2 hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center">
        <span className="text-sm text-text-secondary">Loading...</span>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
