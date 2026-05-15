'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { gmailIntegrationService } from '@/services/gmailIntegration';

type State = 'loading' | 'success' | 'error';

export default function GmailCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code  = searchParams.get('code');
    const err   = searchParams.get('error');

    if (err) {
      setState('error');
      setError(err === 'access_denied' ? 'You cancelled the Google sign-in.' : `Google error: ${err}`);
      return;
    }
    if (!code) {
      setState('error');
      setError('No authorization code received from Google.');
      return;
    }

    gmailIntegrationService
      .handleCallback(code)
      .then(() => {
        setState('success');
        setTimeout(() => router.push('/contacts?gmail=connected'), 2000);
      })
      .catch(e => {
        setState('error');
        setError(e?.message ?? 'Failed to connect Gmail. Please try again.');
      });
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-main-bg gap-4 text-center px-4">
      {state === 'loading' && (
        <>
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-primary-text font-medium">Connecting your Gmail account…</p>
          <p className="text-sm text-secondary-text">This will only take a moment.</p>
        </>
      )}

      {state === 'success' && (
        <>
          <CheckCircle className="w-12 h-12 text-green-500" />
          <p className="text-primary-text font-semibold text-lg">Gmail connected!</p>
          <p className="text-sm text-secondary-text">Redirecting you back to Contacts…</p>
        </>
      )}

      {state === 'error' && (
        <>
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-primary-text font-semibold text-lg">Connection failed</p>
          <p className="text-sm text-secondary-text max-w-sm">{error}</p>
          <button
            onClick={() => router.push('/contacts')}
            className="mt-2 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            Back to Contacts
          </button>
        </>
      )}
    </div>
  );
}
