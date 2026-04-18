'use client';

import { useEffect, useState } from 'react';
import {
  createWhatsAppManual,
  getWhatsAppWebhookConfig,
  verifyWhatsAppManual,
  type WhatsAppVerifyResult,
  type WhatsAppWebhookConfig,
} from '@/services/channels';

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function WhatsAppManualConnectModal({ open, onClose, onConnected }: Props) {
  const [webhookConfig, setWebhookConfig] = useState<WhatsAppWebhookConfig | null>(null);
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<WhatsAppVerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVerifyResult(null);
    setVerifyError(null);
    setSaveError(null);
    getWhatsAppWebhookConfig()
      .then(setWebhookConfig)
      .catch(() => setWebhookConfig(null));
  }, [open]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // clipboard unavailable, ignore
    }
  };

  const canVerify = phoneNumberId.trim() && accessToken.trim();
  const canSave = wabaId.trim() && phoneNumberId.trim() && accessToken.trim();

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await verifyWhatsAppManual({
        waba_id: wabaId.trim() || undefined,
        phone_number_id: phoneNumberId.trim(),
        access_token: accessToken.trim(),
      });
      setVerifyResult(res);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await createWhatsAppManual({
        waba_id: wabaId.trim(),
        phone_number_id: phoneNumberId.trim(),
        access_token: accessToken.trim(),
        display_name: displayName.trim() || undefined,
      });
      onConnected();
      onClose();
      setWabaId('');
      setPhoneNumberId('');
      setAccessToken('');
      setDisplayName('');
      setVerifyResult(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add channel');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg shadow-xl">
        <div className="flex items-start justify-between border-b border-border-color p-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Connect WhatsApp (Manual)</h3>
            <p className="mt-0.5 text-sm text-text-secondary">
              Use this when Meta Embedded Signup isn&apos;t available yet. The client generates the
              credentials in their Meta Business account and pastes them here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Step 1 — Webhook settings */}
          <section>
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Step 1 — Paste these into Meta Developer app → WhatsApp → Configuration
            </div>
            <div className="space-y-2 rounded-lg border border-border-color bg-bg-secondary/40 p-3 text-sm">
              <FieldCopyRow
                label="Callback URL"
                value={webhookConfig?.callback_url ?? 'Loading…'}
                onCopy={() => webhookConfig && handleCopy(webhookConfig.callback_url, 'cb')}
                copied={copied === 'cb'}
              />
              <FieldCopyRow
                label="Verify token"
                value={webhookConfig?.verify_token ?? 'Loading…'}
                onCopy={() => webhookConfig && handleCopy(webhookConfig.verify_token, 'vt')}
                copied={copied === 'vt'}
                masked
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-text-secondary">
                  Subscribe to fields
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {(webhookConfig?.subscribed_fields ?? []).join(', ') || '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Step 2 — Credentials */}
          <section>
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Step 2 — Paste the client&apos;s credentials
            </div>
            <div className="space-y-3">
              <Field
                label="WhatsApp Business Account ID (WABA)"
                value={wabaId}
                onChange={setWabaId}
                placeholder="e.g. 102290129340398"
              />
              <Field
                label="Phone Number ID"
                value={phoneNumberId}
                onChange={setPhoneNumberId}
                placeholder="e.g. 106540352242922"
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Permanent Access Token
                </label>
                <div className="flex gap-2">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAAG…"
                    className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((s) => !s)}
                    className="rounded-md border border-border-color px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Use a System User token with <code>whatsapp_business_messaging</code> +{' '}
                  <code>whatsapp_business_management</code> scopes (won&apos;t expire).
                </p>
              </div>
              <Field
                label="Display name (optional)"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Auto-filled from Meta if left blank"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleVerify}
                disabled={!canVerify || verifying}
                className="rounded-md border border-border-color px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
              >
                {verifying ? 'Testing…' : 'Test connection'}
              </button>
              {verifyResult && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                  ✓ Verified: {verifyResult.display_phone_number || '—'}
                  {verifyResult.verified_name ? ` (${verifyResult.verified_name})` : ''}
                </span>
              )}
              {verifyError && (
                <span className="text-sm text-red-600 dark:text-red-400">{verifyError}</span>
              )}
            </div>
          </section>

          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {saveError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-color p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & Subscribe Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-secondary">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
      />
    </div>
  );
}

function FieldCopyRow({
  label,
  value,
  onCopy,
  copied,
  masked = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  masked?: boolean;
}) {
  const [reveal, setReveal] = useState(!masked);
  const display = masked && !reveal ? '•'.repeat(Math.min(value.length, 20) || 8) : value;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate rounded border border-border-color bg-bg-primary px-2 py-1 font-mono text-xs text-text-primary">
          {display}
        </span>
        {masked && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="rounded border border-border-color px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-border-color px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
