'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  acceptEmployeeInvite,
  validateEmployeeInvite,
  type EmployeeInviteValidateResult,
} from '@/services/employees';
import { useAuthStore } from '@/lib/auth-store';
import { broadcastAuthEvent } from '@/lib/auth-events';
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);
  const setDefaultBusinessId = useAuthStore((s) => s.setDefaultBusinessId);
  const setDefaultRole = useAuthStore((s) => s.setDefaultRole);
  const setHasActiveBusinessAccess = useAuthStore((s) => s.setHasActiveBusinessAccess);

  const [validation, setValidation] = useState<EmployeeInviteValidateResult | null>(null);
  const [validating, setValidating] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function runValidation() {
      if (!token) {
        setValidation({ valid: false });
        setValidating(false);
        return;
      }
      setValidating(true);
      setError(null);
      try {
        const result = await validateEmployeeInvite(token);
        if (!cancelled) {
          setValidation(result);
          if (result.name) setName(result.name);
        }
      } catch (err) {
        if (!cancelled) {
          setValidation({ valid: false });
          setError(err instanceof Error ? err.message : 'Could not validate invite token.');
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }

    void runValidation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invite token is missing.');
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      const result = await acceptEmployeeInvite({
        token,
        password,
        name: name.trim() || undefined,
      });

      setAccessToken(result.access_token);
      setUser(null);
      setOnboardingRequired(false);
      setDefaultBusinessId(null);
      setDefaultRole(result.role);
      setHasActiveBusinessAccess(true);
      broadcastAuthEvent('login');

      if (typeof document !== 'undefined' && result.refresh_token) {
        try {
          document.cookie = `refresh_token=${encodeURIComponent(result.refresh_token)}; path=/;`;
        } catch {
          // ignore cookie write errors
        }
      }

      router.replace(
        resolvePostAuthRedirect({
          onboardingRequired: false,
          defaultRole: result.role,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-md md:max-w-lg rounded-2xl border border-border-color bg-card-bg p-8 md:p-10 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-text-primary">Accept team invite</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Set your password to join your team workspace.
        </p>

        {validating ? (
          <p className="text-sm text-text-secondary">Validating invite...</p>
        ) : !validation?.valid ? (
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error ||
                (validation?.status
                  ? `This invite is ${validation.status}. Ask your business owner to send a new invite.`
                  : 'Invite is invalid or expired.')}
            </div>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent"
            >
              Go to login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-secondary">
              <div>
                <span className="font-medium text-text-primary">Email:</span> {validation.email}
              </div>
              <div>
                <span className="font-medium text-text-primary">Role:</span> {validation.role}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleAccept} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Your display name"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Password</label>
                <input
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="At least 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={submitLoading || password.length < 8}
                className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitLoading ? 'Joining workspace...' : 'Accept invite'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-secondary text-text-primary flex items-center justify-center">
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
