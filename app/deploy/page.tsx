'use client';

import { useState, useEffect, FormEvent } from 'react';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { getStorefrontConfig, updateStorefrontConfig, type StorefrontConfig } from '@/lib/storefront-api';
import { apiFetch, type ApiError } from '@/lib/api-client';

export default function DeployPage() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [slug, setSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await getStorefrontConfig();
      setConfig(data);
      setSlug(data.storefront_slug || '');
      setSubdomain(data.storefront_subdomain || '');
      setCustomDomain(data.custom_domain || '');
      setEnabled(data.storefront_enabled);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load storefront config');
    }
  };

  const generateSlugFromName = async () => {
    try {
      const user = await apiFetch<any>('/users/me', { method: 'GET' });
      if (user && user.business && user.business.name) {
        const generated = user.business.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        setSlug(generated);
      }
    } catch (err) {
      // Ignore errors
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const updated = await updateStorefrontConfig({
        storefront_slug: slug || null,
        storefront_subdomain: subdomain || null,
        custom_domain: customDomain || null,
        storefront_enabled: enabled,
      });

      setConfig(updated);
      setSuccess('Storefront configuration updated successfully!');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to update storefront config');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedShell>
        <ModuleGuard module="agents">
        <div className="max-w-4xl space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Deploy Storefront</h2>
            <p className="text-sm text-text-secondary mt-1">
              Configure your public storefront URL and settings
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Storefront Settings</h3>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Storefront Slug
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="my-business"
                    className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={generateSlugFromName}
                    className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary hover:bg-bg-primary"
                  >
                    Auto-generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  URL: mybizai.in/store/{slug || 'your-slug'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Subdomain
                </label>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="mybusiness"
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="mt-1 text-xs text-text-secondary">
                  URL: {subdomain || 'your-subdomain'}.mybizai.in
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Custom Domain (Optional)
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="capsrightprice.in"
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Connect your own domain. DNS setup required separately.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-text-primary">
                  Enable Storefront
                </label>
              </div>
            </div>

            {config && (config.slug_url || config.subdomain_url || config.custom_domain_url) && (
              <div className="rounded-xl border border-border-color bg-card-bg p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Your Storefront URLs</h3>
                <div className="space-y-2">
                  {config.slug_url && (
                    <div>
                      <span className="text-xs text-text-secondary">Slug URL:</span>
                      <a
                        href={`https://${config.slug_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-accent hover:underline"
                      >
                        {config.slug_url}
                      </a>
                    </div>
                  )}
                  {config.subdomain_url && (
                    <div>
                      <span className="text-xs text-text-secondary">Subdomain URL:</span>
                      <a
                        href={`https://${config.subdomain_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-accent hover:underline"
                      >
                        {config.subdomain_url}
                      </a>
                    </div>
                  )}
                  {config.custom_domain_url && (
                    <div>
                      <span className="text-xs text-text-secondary">Custom Domain:</span>
                      <a
                        href={`https://${config.custom_domain_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-accent hover:underline"
                      >
                        {config.custom_domain_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Storefront Configuration'}
            </button>
          </form>
        </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
