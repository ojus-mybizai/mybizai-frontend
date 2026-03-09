'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import {
  getStorefrontCustomization,
  updateStorefrontCustomization,
  uploadStorefrontLogo,
  uploadStorefrontCover,
  type StorefrontCustomization,
} from '@/lib/storefront-api';
import { apiFetch, type ApiError } from '@/lib/api-client';

const THEMES = [
  { value: 'default', label: 'Default', description: 'Clean and professional' },
  { value: 'minimal', label: 'Minimal', description: 'Simple and elegant' },
  { value: 'modern', label: 'Modern', description: 'Bold and contemporary' },
  { value: 'classic', label: 'Classic', description: 'Traditional and timeless' },
];

export default function StorefrontSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [customization, setCustomization] = useState<StorefrontCustomization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [brandColor, setBrandColor] = useState('#3B82F6');
  const [theme, setTheme] = useState('default');
  const [tagline, setTagline] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    loadCustomization();
  }, []);

  const loadCustomization = async () => {
    try {
      const data = await getStorefrontCustomization();
      setCustomization(data);
      setBrandColor(data.storefront_brand_color || '#3B82F6');
      setTheme(data.storefront_theme || 'default');
      setTagline(data.storefront_tagline || '');
      
      const social = data.storefront_social_links || {};
      setInstagram(social.instagram || '');
      setFacebook(social.facebook || '');
      setTwitter(social.twitter || '');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load customization');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setError(null);
    try {
      const result = await uploadStorefrontLogo(file);
      await loadCustomization(); // Reload to get updated signed URL
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverUploading(true);
    setError(null);
    try {
      const result = await uploadStorefrontCover(file);
      await loadCustomization(); // Reload to get updated signed URL
      setSuccess('Cover image uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to upload cover image');
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const socialLinks: Record<string, string> = {};
      if (instagram) socialLinks.instagram = instagram;
      if (facebook) socialLinks.facebook = facebook;
      if (twitter) socialLinks.twitter = twitter;

      await updateStorefrontCustomization({
        storefront_brand_color: brandColor,
        storefront_theme: theme,
        storefront_tagline: tagline || null,
        storefront_social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      });

      await loadCustomization();
      setSuccess('Storefront customization updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to update customization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Storefront Customization</h2>
            <p className="text-sm text-text-secondary mt-1">
              Customize your storefront appearance, branding, and theme
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
            {/* Logo Upload */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Logo</h3>
              <div className="flex items-start gap-4">
                {customization?.logo_url && (
                  <img
                    src={customization.logo_url}
                    alt="Logo"
                    className="w-24 h-24 object-contain rounded-lg border border-border-color bg-white p-2"
                  />
                )}
                <div className="flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={logoUploading}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="inline-block rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-sm text-text-secondary hover:bg-bg-primary cursor-pointer disabled:opacity-60"
                  >
                    {logoUploading ? 'Uploading...' : customization?.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  <p className="mt-2 text-xs text-text-secondary">
                    Recommended: Square logo, 200x200px or larger, PNG or JPG
                  </p>
                </div>
              </div>
            </div>

            {/* Cover Image Upload */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Cover Image</h3>
              <div className="space-y-4">
                {customization?.cover_image_url && (
                  <img
                    src={customization.cover_image_url}
                    alt="Cover"
                    className="w-full h-48 object-cover rounded-lg border border-border-color"
                  />
                )}
                <div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={coverUploading}
                    className="hidden"
                    id="cover-upload"
                  />
                  <label
                    htmlFor="cover-upload"
                    className="inline-block rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-sm text-text-secondary hover:bg-bg-primary cursor-pointer disabled:opacity-60"
                  >
                    {coverUploading ? 'Uploading...' : customization?.cover_image_url ? 'Change Cover Image' : 'Upload Cover Image'}
                  </label>
                  <p className="mt-2 text-xs text-text-secondary">
                    Recommended: 1920x600px, JPG or PNG. This appears at the top of your storefront.
                  </p>
                </div>
              </div>
            </div>

            {/* Brand Color */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Brand Color</h3>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-16 h-16 rounded border border-border-color cursor-pointer"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    This color will be used for buttons, links, and accents
                  </p>
                </div>
              </div>
            </div>

            {/* Theme */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Theme</h3>
              <div className="grid grid-cols-2 gap-3">
                {THEMES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      theme === t.value
                        ? 'border-accent bg-accent/10'
                        : 'border-border-color hover:bg-bg-secondary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={t.value}
                      checked={theme === t.value}
                      onChange={(e) => setTheme(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{t.label}</div>
                      <div className="text-xs text-text-secondary">{t.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Tagline */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Tagline</h3>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Your business tagline or slogan"
                maxLength={255}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-text-secondary">
                A short tagline that appears in your storefront hero section
              </p>
            </div>

            {/* Social Links */}
            <div className="rounded-xl border border-border-color bg-card-bg p-6 space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Social Media Links</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="https://instagram.com/yourhandle"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="https://facebook.com/yourpage"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Twitter/X
                  </label>
                  <input
                    type="url"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="https://twitter.com/yourhandle"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Customization'}
            </button>
          </form>
        </div>
  );
}
