'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import CatalogForm from '@/components/catalog/catalog-form';
import { useCatalogStore } from '@/lib/catalog-store';

export default function CatalogNewPage() {
  const router = useRouter();
  const { templates, loadTemplates, categories, loadCategories } = useCatalogStore((s) => ({
    templates: s.templates,
    loadTemplates: s.loadTemplates,
    categories: s.categories,
    loadCategories: s.loadCategories,
  }));

  useEffect(() => {
    if (!templates.length) void loadTemplates();
    if (!categories.length) void loadCategories();
  }, [categories.length, loadCategories, loadTemplates, templates.length]);

  return (
    <ProtectedShell>
      <div className="mx-auto max-w-5xl space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Add catalog item</h1>
            <p className="text-sm text-text-secondary">Create a new product or service in your catalog.</p>
          </div>

          <CatalogForm mode="create" templates={templates} />
        </div>
    </ProtectedShell>
  );
}
