import { apiFetch, type ApiError } from './api-client';

export interface StorefrontConfig {
  storefront_slug: string | null;
  storefront_subdomain: string | null;
  custom_domain: string | null;
  storefront_enabled: boolean;
  slug_url: string | null;
  subdomain_url: string | null;
  custom_domain_url: string | null;
}

export interface StorefrontConfigUpdate {
  storefront_slug?: string | null;
  storefront_subdomain?: string | null;
  custom_domain?: string | null;
  storefront_enabled?: boolean;
}

export async function getStorefrontConfig(): Promise<StorefrontConfig> {
  return apiFetch<StorefrontConfig>('/business/storefront', { method: 'GET' });
}

export async function updateStorefrontConfig(
  config: StorefrontConfigUpdate
): Promise<StorefrontConfig> {
  return apiFetch<StorefrontConfig>('/business/storefront', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export interface StorefrontCustomization {
  storefront_logo: string | null;
  storefront_cover_image: string | null;
  storefront_brand_color: string | null;
  storefront_theme: string;
  storefront_tagline: string | null;
  storefront_social_links: Record<string, string> | null;
  storefront_meta: Record<string, any> | null;
  logo_url: string | null;
  cover_image_url: string | null;
}

export interface StorefrontCustomizationUpdate {
  storefront_logo?: string | null;
  storefront_cover_image?: string | null;
  storefront_brand_color?: string | null;
  storefront_theme?: string;
  storefront_tagline?: string | null;
  storefront_social_links?: Record<string, string> | null;
  storefront_meta?: Record<string, any> | null;
}

export async function getStorefrontCustomization(): Promise<StorefrontCustomization> {
  return apiFetch<StorefrontCustomization>('/business/storefront/customization', { method: 'GET' });
}

export async function updateStorefrontCustomization(data: StorefrontCustomizationUpdate): Promise<StorefrontCustomization> {
  return apiFetch<StorefrontCustomization>('/business/storefront/customization', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadStorefrontLogo(file: File): Promise<{ logo_url: string; object_key: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  // Use shared apiFetch so we get auth refresh/retry behavior.
  return apiFetch<{ logo_url: string; object_key: string; message: string }>(
    '/business/storefront/upload-logo',
    {
      method: 'POST',
      body: formData,
      // Important: don't pass Content-Type; apiFetch will not force it for FormData.
      headers: {},
    }
  );
}

export async function uploadStorefrontCover(file: File): Promise<{ cover_image_url: string; object_key: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<{ cover_image_url: string; object_key: string; message: string }>(
    '/business/storefront/upload-cover',
    {
      method: 'POST',
      body: formData,
      headers: {},
    }
  );
}
