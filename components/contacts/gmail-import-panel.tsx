'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, Unlink, Loader2, CheckCircle } from 'lucide-react';
import { gmailIntegrationService, type GmailStatus, type GmailSyncResult } from '@/services/gmailIntegration';

interface Props {
  onSynced: () => void;  // refresh contacts list after sync
}

export function GmailImportPanel({ onSynced }: Props) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [lastResult, setLastResult] = useState<GmailSyncResult | null>(null);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const s = await gmailIntegrationService.getStatus();
      setStatus(s);
    } catch {
      // not configured or network error — silently hide
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => { void loadStatus(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await gmailIntegrationService.getAuthUrl();
      window.location.href = authUrl;
    } catch (e: any) {
      setError(e?.message ?? 'Could not start Google sign-in.');
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setLastResult(null);
    try {
      const result = await gmailIntegrationService.sync();
      setLastResult(result);
      await loadStatus();
      onSynced();
    } catch (e: any) {
      setError(e?.message ?? 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Gmail? Contacts already imported will remain.')) return;
    setDisconnecting(true);
    try {
      await gmailIntegrationService.disconnect();
      setStatus({ connected: false, lastSyncAt: null, contactsSynced: 0 });
      setLastResult(null);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loadingStatus) return null; // hide while loading — avoid flash

  return (
    <div className="border border-border-color rounded-xl p-4 bg-bg-secondary/40">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
          <Mail className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-text">Google Contacts</p>
          <p className="text-xs text-secondary-text">
            {status?.connected ? 'Connected' : 'Import contacts from Gmail'}
          </p>
        </div>
        {status?.connected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>

      {/* Not connected */}
      {!status?.connected && (
        <>
          <p className="text-xs text-secondary-text mb-3">
            Connect your Google account to import contacts with phone numbers. They&apos;ll be added in <strong>Manual</strong> mode so you control who gets AI responses.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-border-color rounded-lg hover:bg-bg-secondary transition-colors text-primary-text disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {connecting ? 'Redirecting…' : 'Sign in with Google'}
          </button>
        </>
      )}

      {/* Connected */}
      {status?.connected && (
        <>
          {status.lastSyncAt && (
            <p className="text-xs text-secondary-text mb-1">
              Last sync: {new Date(status.lastSyncAt).toLocaleString()} · {status.contactsSynced} imported
            </p>
          )}

          {lastResult && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
              Sync complete — <strong>{lastResult.imported}</strong> new contacts imported, {lastResult.skipped} skipped
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60 transition-colors"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
