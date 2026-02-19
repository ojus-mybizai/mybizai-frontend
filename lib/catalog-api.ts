import { apiFetch, API_BASE_URL, type ApiError } from './api-client';
import { useAuthStore } from './auth-store';

export interface CatalogItem {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  availability: 'available' | 'out_of_stock' | 'discontinued';
  type: 'product' | 'service';
  sku: string | null;
  stock: number | null;
  low_stock_threshold: number | null;
  tags: string[] | null;
  variants: Record<string, unknown> | null;
  images: string[];
  metadata: Record<string, unknown>;
  template_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CatalogItemListResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface CatalogItemCreate {
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  currency?: string;
  availability?: 'available' | 'out_of_stock' | 'discontinued';
  type?: 'product' | 'service';
  sku?: string | null;
  stock?: number | null;
  low_stock_threshold?: number | null;
  tags?: string[];
  variants?: Record<string, unknown>;
  images?: string[];
  metadata?: Record<string, unknown>;
  template_id?: number | null;
}

export interface CatalogItemUpdate {
  name?: string;
  description?: string | null;
  category?: string | null;
  price?: number;
  currency?: string;
  availability?: 'available' | 'out_of_stock' | 'discontinued';
  type?: 'product' | 'service';
  sku?: string | null;
  stock?: number | null;
  low_stock_threshold?: number | null;
  tags?: string[];
  variants?: Record<string, unknown>;
  images?: string[];
  metadata?: Record<string, unknown>;
  template_id?: number | null;
}

export interface CatalogTemplate {
  id: number;
  business_id: number;
  name: string;
  extra_metadata: string[];
  created_at: string;
  updated_at: string | null;
}

export interface CatalogTemplateCreate {
  name: string;
  extra_metadata: string[];
}

export interface CategoryListResponse {
  categories: string[];
}

export interface CatalogStatsSummary {
  total_items: number;
  by_type: {
    product?: number;
    service?: number;
  };
  by_availability: {
    available?: number;
    out_of_stock?: number;
    discontinued?: number;
  };
  average_price: number;
}

export interface CatalogBestSoldItem {
  catalog_item_id: number;
  name: string;
  quantity_sold: number;
  revenue?: number;
}

export interface CatalogItemRecentOrder {
  order_id: number;
  created_at: string;
  status: string;
  payment_status: string;
  quantity: number;
  revenue: number;
  currency: string;
}

export interface CatalogItemInsights {
  catalog_item_id: number;
  order_count: number;
  total_quantity_sold: number;
  total_revenue: number;
  last_sold_at: string | null;
  recent_orders: CatalogItemRecentOrder[];
}

export interface ImageUploadResponse {
  url: string;
  filename: string;
}

export interface ListCatalogParams {
  category?: string;
  type?: 'product' | 'service';
  availability?: 'available' | 'out_of_stock' | 'discontinued';
  search?: string;
  tags?: string[];
  price_min?: number;
  price_max?: number;
  stock_min?: number;
  stock_max?: number;
  page?: number;
  per_page?: number;
}

function buildListQuery(params: ListCatalogParams): string {
  const search = new URLSearchParams();

  if (params.category) search.set('category', params.category);
  if (params.type) search.set('type', params.type);
  if (params.availability) search.set('availability', params.availability);
  if (params.search) search.set('search', params.search);
  if (params.price_min !== undefined) search.set('price_min', String(params.price_min));
  if (params.price_max !== undefined) search.set('price_max', String(params.price_max));
  if (params.stock_min !== undefined) search.set('stock_min', String(params.stock_min));
  if (params.stock_max !== undefined) search.set('stock_max', String(params.stock_max));
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.per_page !== undefined) search.set('per_page', String(params.per_page));

  if (params.tags && params.tags.length) {
    for (const tag of params.tags) {
      const trimmed = tag.trim();
      if (trimmed) search.append('tags', trimmed);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listCatalogItems(params: ListCatalogParams): Promise<CatalogItemListResponse> {
  const query = buildListQuery(params);
  return apiFetch<CatalogItemListResponse>(`/catalog/${query}`, { method: 'GET' });
}

export async function getCatalogItem(id: number): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalog/${id}`, { method: 'GET' });
}

export async function createCatalogItem(body: CatalogItemCreate): Promise<CatalogItem> {
  return apiFetch<CatalogItem>('/catalog/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCatalogItem(id: number, body: CatalogItemUpdate): Promise<CatalogItem> {
  return apiFetch<CatalogItem>(`/catalog/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteCatalogItem(id: number): Promise<void> {
  await apiFetch<void>(`/catalog/${id}`, { method: 'DELETE' });
}

export async function listCatalogCategories(): Promise<CategoryListResponse> {
  return apiFetch<CategoryListResponse>('/catalog/categories/list', { method: 'GET' });
}

export async function getCatalogStatsSummary(): Promise<CatalogStatsSummary> {
  return apiFetch<CatalogStatsSummary>('/catalog/stats/summary', { method: 'GET' });
}

export async function getCatalogBestSold(limit: number = 5): Promise<CatalogBestSoldItem[]> {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  return apiFetch<CatalogBestSoldItem[]>(`/catalog/stats/best_sold?${q.toString()}`, { method: 'GET' });
}

export async function getCatalogItemInsights(id: number, recentLimit: number = 5): Promise<CatalogItemInsights> {
  const q = new URLSearchParams();
  q.set('recent_limit', String(recentLimit));
  return apiFetch<CatalogItemInsights>(`/catalog/${id}/insights?${q.toString()}`, { method: 'GET' });
}

export async function listCatalogTemplates(): Promise<CatalogTemplate[]> {
  return apiFetch<CatalogTemplate[]>('/catalog/templates', { method: 'GET' });
}

export async function createCatalogTemplate(body: CatalogTemplateCreate): Promise<CatalogTemplate> {
  return apiFetch<CatalogTemplate>('/catalog/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCatalogTemplate(id: number, body: Partial<CatalogTemplateCreate>): Promise<CatalogTemplate> {
  return apiFetch<CatalogTemplate>(`/catalog/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteCatalogTemplate(id: number): Promise<void> {
  await apiFetch<void>(`/catalog/templates/${id}`, { method: 'DELETE' });
}

/** Upload one or more images. Returns a list of { url, filename } (one per file). */
export async function uploadCatalogImages(files: File[]): Promise<ImageUploadResponse[]> {
  if (files.length === 0) return [];
  const state = useAuthStore.getState();
  const token = state.accessToken;
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}/catalog/upload-image`, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  if (!response.ok) {
    const message = (data && (typeof data.detail === 'string' ? data.detail : data.message)) || `Image upload failed with status ${response.status}`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const list = Array.isArray(data) ? data : [data];
  return list.map((item: any) => ({
    url: String(item.url),
    filename: String(item.filename ?? ''),
  }));
}

/** Upload a single image. Convenience wrapper. */
export async function uploadCatalogImage(file: File): Promise<ImageUploadResponse> {
  const results = await uploadCatalogImages([file]);
  return results[0];
}
