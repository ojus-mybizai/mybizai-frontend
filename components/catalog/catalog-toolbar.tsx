'use client';

import { type ChangeEvent } from 'react';
import TagInput from './tag-input';

interface CatalogToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  typeFilter: '' | 'product' | 'service';
  onTypeFilterChange: (value: '' | 'product' | 'service') => void;
  availability: '' | 'available' | 'out_of_stock' | 'discontinued';
  onAvailabilityChange: (value: '' | 'available' | 'out_of_stock' | 'discontinued') => void;
  tagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  sort: 'recent' | 'name_asc' | 'price_asc' | 'price_desc';
  onSortChange: (value: 'recent' | 'name_asc' | 'price_asc' | 'price_desc') => void;
  categories: string[];
  onNewItem: () => void;
  onOpenCsvImport: () => void;
}

export default function CatalogToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  typeFilter,
  onTypeFilterChange,
  availability,
  onAvailabilityChange,
  tagFilters,
  onTagFiltersChange,
  sort,
  onSortChange,
  categories,
  onNewItem,
  onOpenCsvImport,
}: CatalogToolbarProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange(event.target.value);
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onTypeFilterChange(event.target.value as any);
  };

  const handleAvailabilityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onAvailabilityChange(event.target.value as any);
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSortChange(event.target.value as any);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">Catalog</h1>
          <p className="text-xs text-text-secondary">
            Manage products and services for your business catalog.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={onOpenCsvImport}
            className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-text-secondary hover:text-text-primary"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={onNewItem}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Add new item
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-1 md:col-span-2">
          <label className="block text-xs font-medium text-text-primary">Search</label>
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by name or description"
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Category</label>
          <select
            value={category}
            onChange={handleCategoryChange}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Sort</label>
          <select
            value={sort}
            onChange={handleSortChange}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="recent">Most recent</option>
            <option value="name_asc">Name A–Z</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Type</label>
          <select
            value={typeFilter}
            onChange={handleTypeChange}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All</option>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Availability</label>
          <select
            value={availability}
            onChange={handleAvailabilityChange}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All</option>
            <option value="available">Available</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="block text-xs font-medium text-text-primary">Tags filter</label>
          <TagInput
            value={tagFilters}
            onChange={onTagFiltersChange}
            placeholder="Filter by tags (press Enter to add)"
          />
        </div>
      </div>
    </div>
  );
}
