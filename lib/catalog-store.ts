'use client';

import { create } from 'zustand';
import {
  listCatalogItems,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  listCatalogTemplates,
  createCatalogTemplate,
  updateCatalogTemplate,
  deleteCatalogTemplate,
  listCatalogCategories,
  getCatalogStatsSummary,
  getCatalogBestSold,
  getCatalogItemInsights,
  type CatalogItem,
  type CatalogItemCreate,
  type CatalogItemUpdate,
  type CatalogTemplate,
  type CatalogBestSoldItem,
  type CatalogItemInsights,
  type ListCatalogParams,
} from '@/lib/catalog-api';

interface CatalogState {
  items: CatalogItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  current: CatalogItem | null;
  templates: CatalogTemplate[];
  categories: string[];
  stats: {
    total: number;
    products: number;
    services: number;
    availability: Record<string, number>;
    averagePrice: number;
  } | null;
  statsError: string | null;
  bestSold: CatalogBestSoldItem[] | null;
  itemInsights: CatalogItemInsights | null;
  itemInsightsLoading: boolean;
  itemInsightsError: string | null;
  list(params?: ListCatalogParams): Promise<void>;
  select(id: string): Promise<void>;
  create(input: CatalogItemCreate): Promise<CatalogItem>;
  update(id: string, input: CatalogItemUpdate): Promise<CatalogItem>;
  remove(id: string): Promise<void>;
  loadTemplates(): Promise<void>;
  createTemplate(input: { name: string; extra_metadata: string[] }): Promise<CatalogTemplate>;
  editTemplate(id: string, input: Partial<{ name: string; extra_metadata: string[] }>): Promise<CatalogTemplate>;
  removeTemplate(id: string): Promise<void>;
  loadCategories(): Promise<void>;
  loadStats(): Promise<void>;
  loadBestSold(limit?: number): Promise<void>;
  loadItemInsights(id: string, recentLimit?: number): Promise<void>;
  resetError(): void;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  page: 1,
  perPage: 10,
  total: 0,
  totalPages: 1,
  loading: false,
  error: null,
  current: null,
  templates: [],
  categories: [],
  stats: null,
  statsError: null,
  bestSold: null,
  itemInsights: null,
  itemInsightsLoading: false,
  itemInsightsError: null,

  async list(params) {
    set({ loading: true, error: null });
    try {
      const data = await listCatalogItems({
        ...(params || {}),
        page: params?.page ?? 1,
        per_page: params?.per_page ?? params?.per_page ?? 10,
      } as any);
      set({
        items: data.items,
        page: data.page,
        perPage: data.per_page,
        total: data.total,
        totalPages: data.total_pages,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async select(id) {
    set({ loading: true, error: null });
    try {
      const item = await getCatalogItem(Number(id));
      set({ current: item, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async create(input) {
    set({ loading: true, error: null });
    try {
      const created = await createCatalogItem(input);
      set({ items: [created, ...get().items], loading: false });
      return created;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, input) {
    set({ loading: true, error: null });
    try {
      const updated = await updateCatalogItem(Number(id), input);
      set({
        items: get().items.map((i) => (String(i.id) === id ? updated : i)),
        current: updated,
        loading: false,
      });
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async remove(id) {
    set({ loading: true, error: null });
    try {
      await deleteCatalogItem(Number(id));
      const curr = get().current;
      set({
        items: get().items.filter((i) => String(i.id) !== id),
        current: curr && String(curr.id) === id ? null : curr,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async loadTemplates() {
    set({ loading: true, error: null });
    try {
      const templates = await listCatalogTemplates();
      set({ templates, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async createTemplate(input) {
    const created = await createCatalogTemplate(input as any);
    set({ templates: [created, ...get().templates] });
    return created;
  },

  async editTemplate(id, input) {
    const updated = await updateCatalogTemplate(Number(id), input as any);
    set({ templates: get().templates.map((t) => (String(t.id) === id ? updated : t)) });
    return updated;
  },

  async removeTemplate(id) {
    await deleteCatalogTemplate(Number(id));
    set({ templates: get().templates.filter((t) => String(t.id) !== id) });
  },

  async loadCategories() {
    try {
      const data = await listCatalogCategories();
      set({ categories: data.categories });
    } catch {
      // ignore
    }
  },

  async loadStats() {
    set({ statsError: null });
    try {
      const s = await getCatalogStatsSummary();
      set({
        stats: {
          total: s.total_items,
          products: s.by_type.product ?? 0,
          services: s.by_type.service ?? 0,
          availability: s.by_availability as any,
          averagePrice: s.average_price,
        },
        statsError: null,
      });
    } catch (err) {
      set({
        statsError: err instanceof Error ? err.message : 'Could not load catalog stats',
      });
    }
  },

  async loadBestSold(limit: number = 5) {
    try {
      const data = await getCatalogBestSold(limit);
      set({ bestSold: data });
    } catch {
      set({ bestSold: [] });
    }
  },

  async loadItemInsights(id: string, recentLimit: number = 5) {
    set({ itemInsightsLoading: true, itemInsightsError: null });
    try {
      const insights = await getCatalogItemInsights(Number(id), recentLimit);
      set({ itemInsights: insights, itemInsightsLoading: false, itemInsightsError: null });
    } catch (err) {
      set({
        itemInsightsLoading: false,
        itemInsights: null,
        itemInsightsError: err instanceof Error ? err.message : 'Could not load item insights',
      });
    }
  },

  resetError() {
    set({ error: null, itemInsightsError: null });
  },
}));

