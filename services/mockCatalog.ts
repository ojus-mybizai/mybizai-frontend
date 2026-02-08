// Mock catalog service layer for demo; swap with real API calls later.
export type CatalogType = 'product' | 'service';
export type Availability = 'available' | 'out_of_stock' | 'discontinued';

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  type: CatalogType;
  category?: string;
  price: number;
  currency: string;
  availability: Availability;
  stock?: number | null;
  low_stock_threshold?: number | null;
  tags: string[];
  variants?: Record<string, unknown> | null;
  metadata: Record<string, string>;
  images: string[];
  templateId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  fields: string[];
  createdAt: string;
}

export interface CatalogFilters {
  search?: string;
  category?: string;
  type?: CatalogType;
  availability?: Availability;
  priceMin?: number;
  priceMax?: number;
  tags?: string[];
  page?: number;
  perPage?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const placeholderImg = (seed: string) => `https://picsum.photos/seed/${seed}/640/360`;

let templates: CatalogTemplate[] = [
  { id: uid(), name: 'Default', fields: ['brand', 'sku', 'color'], createdAt: new Date().toISOString() },
  { id: uid(), name: 'Service Playbook', fields: ['SLA', 'response_time'], createdAt: new Date().toISOString() },
  { id: uid(), name: 'Electronics', fields: ['warranty', 'model'], createdAt: new Date().toISOString() },
];

let items: CatalogItem[] = [
  {
    id: uid(),
    name: 'Wireless Earbuds',
    description: 'Noise-cancelling earbuds with long battery life.',
    type: 'product',
    category: 'Electronics',
    price: 4999,
    currency: 'INR',
    availability: 'available',
    stock: 120,
    low_stock_threshold: 20,
    tags: ['audio', 'wireless'],
    variants: { colors: ['black', 'white'] },
    metadata: { brand: 'SoundPeak', warranty: '12 months' },
    images: [placeholderImg('earbuds')],
    templateId: templates[2].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Laptop Sleeve',
    description: 'Water-resistant 14-inch sleeve.',
    type: 'product',
    category: 'Accessories',
    price: 1299,
    currency: 'INR',
    availability: 'available',
    stock: 80,
    low_stock_threshold: 10,
    tags: ['bag', 'laptop'],
    variants: null,
    metadata: { brand: 'CarryAll' },
    images: [placeholderImg('sleeve')],
    templateId: templates[0].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Smartwatch Repair',
    description: 'Diagnostics and repair for major smartwatch brands.',
    type: 'service',
    category: 'Repair',
    price: 1499,
    currency: 'INR',
    availability: 'available',
    stock: null,
    low_stock_threshold: null,
    tags: ['repair', 'wearables'],
    variants: null,
    metadata: { SLA: '48h' },
    images: [placeholderImg('watchrepair')],
    templateId: templates[1].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Business Consulting (Starter)',
    description: '2-hour consultation for growth strategy.',
    type: 'service',
    category: 'Consulting',
    price: 5999,
    currency: 'INR',
    availability: 'available',
    stock: null,
    low_stock_threshold: null,
    tags: ['consulting', 'strategy'],
    variants: { package: 'starter' },
    metadata: { SLA: 'Next business day' },
    images: [placeholderImg('consulting')],
    templateId: templates[1].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Phone Screen Protector',
    description: 'Tempered glass, edge-to-edge.',
    type: 'product',
    category: 'Accessories',
    price: 499,
    currency: 'INR',
    availability: 'out_of_stock',
    stock: 0,
    low_stock_threshold: 15,
    tags: ['phone', 'screen'],
    variants: { device: 'multiple' },
    metadata: { brand: 'SafeShield' },
    images: [placeholderImg('protector')],
    templateId: templates[0].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Data Cleanup Service',
    description: 'One-time CRM data hygiene and dedupe.',
    type: 'service',
    category: 'Consulting',
    price: 8999,
    currency: 'INR',
    availability: 'out_of_stock',
    stock: null,
    low_stock_threshold: null,
    tags: ['data', 'crm'],
    variants: null,
    metadata: {},
    images: [placeholderImg('datacleanup')],
    templateId: templates[1].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Portable Power Bank',
    description: '20,000 mAh fast-charging power bank.',
    type: 'product',
    category: 'Electronics',
    price: 2499,
    currency: 'INR',
    availability: 'available',
    stock: 55,
    low_stock_threshold: 10,
    tags: ['battery', 'fast-charge'],
    variants: { ports: 3 },
    metadata: { brand: 'VoltGo', warranty: '6 months' },
    images: [placeholderImg('powerbank')],
    templateId: templates[2].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Onsite Installation',
    description: 'Installation service for home electronics.',
    type: 'service',
    category: 'Installation',
    price: 2499,
    currency: 'INR',
    availability: 'available',
    stock: null,
    low_stock_threshold: null,
    tags: ['installation', 'home'],
    variants: null,
    metadata: {},
    images: [placeholderImg('install')],
    templateId: templates[1].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Bluetooth Speaker',
    description: 'Portable speaker with deep bass.',
    type: 'product',
    category: 'Electronics',
    price: 2999,
    currency: 'INR',
    availability: 'discontinued',
    stock: 0,
    low_stock_threshold: 0,
    tags: ['audio', 'portable'],
    variants: null,
    metadata: { brand: 'Pulse' },
    images: [placeholderImg('speaker')],
    templateId: templates[2].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Charging Cable',
    description: 'USB-C to USB-C braided cable, 1.5m.',
    type: 'product',
    category: 'Accessories',
    price: 799,
    currency: 'INR',
    availability: 'available',
    stock: 240,
    low_stock_threshold: 30,
    tags: ['cable', 'usb-c'],
    variants: null,
    metadata: { brand: 'Connectix' },
    images: [placeholderImg('cable')],
    templateId: templates[0].id,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Extended Warranty',
    description: 'Add 12 months extended warranty for devices.',
    type: 'service',
    category: 'Warranty',
    price: 1299,
    currency: 'INR',
    availability: 'available',
    stock: null,
    low_stock_threshold: null,
    tags: ['warranty'],
    variants: null,
    metadata: {},
    images: [placeholderImg('warranty')],
    templateId: templates[1].id,
    createdAt: new Date().toISOString(),
  },
];

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function listCatalogItems(filters: CatalogFilters = {}): Promise<PagedResult<CatalogItem>> {
  const {
    search = '',
    category,
    type,
    availability,
    priceMin,
    priceMax,
    tags = [],
    page = 1,
    perPage = 10,
  } = filters;

  let result = [...items];

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(
      (i) => i.name.toLowerCase().includes(term) || (i.description || '').toLowerCase().includes(term),
    );
  }
  if (category) result = result.filter((i) => i.category === category);
  if (type) result = result.filter((i) => i.type === type);
  if (availability) result = result.filter((i) => i.availability === availability);
  if (typeof priceMin === 'number') result = result.filter((i) => i.price >= priceMin);
  if (typeof priceMax === 'number') result = result.filter((i) => i.price <= priceMax);
  if (tags.length) result = result.filter((i) => tags.every((t) => i.tags.includes(t)));

  const total = result.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const paged = result.slice(start, start + perPage);

  return delay({ items: paged, total, page, perPage, totalPages });
}

export async function getCatalogItem(id: string): Promise<CatalogItem | null> {
  const found = items.find((i) => i.id === id) || null;
  return delay(found);
}

export async function createCatalogItem(input: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CatalogItem> {
  const item: CatalogItem = {
    ...input,
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  items = [item, ...items];
  return delay(item);
}

export async function updateCatalogItem(id: string, input: Partial<Omit<CatalogItem, 'id' | 'createdAt'>>): Promise<CatalogItem> {
  let updated: CatalogItem | null = null;
  items = items.map((i) => {
    if (i.id === id) {
      updated = { ...i, ...input, updatedAt: new Date().toISOString() };
      return updated;
    }
    return i;
  });
  if (!updated) throw new Error('Item not found');
  return delay(updated);
}

export async function deleteCatalogItem(id: string): Promise<void> {
  items = items.filter((i) => i.id !== id);
  return delay(undefined);
}

export async function listCategories(): Promise<string[]> {
  const cats = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];
  return delay(cats);
}

export async function listTemplates(): Promise<CatalogTemplate[]> {
  return delay([...templates]);
}

export async function createTemplate(input: Omit<CatalogTemplate, 'id' | 'createdAt'>): Promise<CatalogTemplate> {
  const tmpl: CatalogTemplate = { ...input, id: uid(), createdAt: new Date().toISOString() };
  templates = [tmpl, ...templates];
  return delay(tmpl);
}

export async function updateTemplate(
  id: string,
  input: Partial<Omit<CatalogTemplate, 'id' | 'createdAt'>>,
): Promise<CatalogTemplate> {
  let updated: CatalogTemplate | null = null;
  templates = templates.map((t) => {
    if (t.id === id) {
      updated = { ...t, ...input };
      return updated;
    }
    return t;
  });
  if (!updated) throw new Error('Template not found');
  return delay(updated);
}

export async function deleteTemplate(id: string): Promise<void> {
  templates = templates.filter((t) => t.id !== id);
  items = items.map((i) => (i.templateId === id ? { ...i, templateId: null } : i));
  return delay(undefined);
}

export async function getCatalogStats() {
  const total = items.length;
  const products = items.filter((i) => i.type === 'product').length;
  const services = items.filter((i) => i.type === 'service').length;
  const availabilityCounts = items.reduce<Record<Availability, number>>(
    (acc, cur) => {
      acc[cur.availability] = (acc[cur.availability] || 0) + 1;
      return acc;
    },
    { available: 0, out_of_stock: 0, discontinued: 0 },
  );
  const avgPrice = items.length ? items.reduce((sum, i) => sum + i.price, 0) / items.length : 0;
  return delay({
    total,
    products,
    services,
    availability: availabilityCounts,
    averagePrice: avgPrice,
  });
}
