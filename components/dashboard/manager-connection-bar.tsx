'use client';

import { useState } from 'react';

export interface ManagerStatus {
  session_id: number;
  is_connected: boolean;
  webhook_token: string;
  last_active_at: string | null;
}

interface ManagerConnectionBarProps {
  status: ManagerStatus | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRegenerateToken: () => void;
  apiBase: string;
}

export default function ManagerConnectionBar({
  status,
  loading,
  onConnect,
  onDisconnect,
  onRegenerateToken,
  apiBase,
}: ManagerConnectionBarProps) {
  const [copied, setCopied] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  const webhookUrl = status
    ? `${apiBase}/api/v1/dashboard/manager/webhook/${status.webhook_token}`
    : '';

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status?.is_connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-text-primary">AI Manager Agent</p>
            <p className="text-xs text-text-secondary">
              {loading
                ? 'Checking status…'
                : status?.is_connected
                ? `Connected · last active ${
                    status.last_active_at
                      ? new Date(status.last_active_at).toLocaleTimeString()
                      : 'never'
                  }`
                : 'Disconnected — connect to enable webhook & persistent chat'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Webhook toggle */}
          <button
            type="button"
            onClick={() => setShowWebhook((v) => !v)}
            className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            {showWebhook ? 'Hide webhook' : 'Webhook URL'}
          </button>

          {/* Connect / Disconnect */}
          {status?.is_connected ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={loading}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={loading}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Webhook URL panel */}
      {showWebhook && status && (
        <div className="mt-3 rounded-lg border border-border-color bg-bg-secondary p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">Webhook URL</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRegenerateToken}
                className="text-xs text-text-secondary hover:text-text-primary underline"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={copyWebhook}
                className="rounded border border-border-color bg-bg-primary px-2 py-0.5 text-xs text-text-primary hover:bg-bg-secondary"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <code className="block break-all text-xs text-accent">{webhookUrl}</code>
          <p className="mt-1.5 text-xs text-text-secondary">
            POST JSON <code className="rounded bg-bg-primary px-1">{'{"message": "..."}'}</code> to
            this URL to send messages into the AI Manager. No auth header needed — the token is the
            credential.{' '}
            {!status.is_connected && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Connect the agent first to allow webhook messages.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
