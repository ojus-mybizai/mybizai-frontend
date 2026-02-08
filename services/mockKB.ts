// Mock service layer for knowledge bases; swap with real API later.

export interface KnowledgeBase {
  id: string;
  title: string;
  sourceType: 'file' | 'text' | 'url';
  entries: number;
  updatedAt: string;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let knowledgeBases: KnowledgeBase[] = [
  {
    id: uid(),
    title: 'Product Catalog Docs',
    sourceType: 'file',
    entries: 48,
    updatedAt: new Date().toISOString(),
  },
  {
    id: uid(),
    title: 'Support Playbook',
    sourceType: 'text',
    entries: 22,
    updatedAt: new Date().toISOString(),
  },
  {
    id: uid(),
    title: 'Pricing FAQ',
    sourceType: 'url',
    entries: 15,
    updatedAt: new Date().toISOString(),
  },
];

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return delay([...knowledgeBases]);
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const kb = knowledgeBases.find((k) => k.id === id) || null;
  return delay(kb);
}

export async function addKnowledgeBase(
  input: Omit<KnowledgeBase, 'id' | 'updatedAt'>,
): Promise<KnowledgeBase> {
  const kb: KnowledgeBase = { ...input, id: uid(), updatedAt: new Date().toISOString() };
  knowledgeBases = [kb, ...knowledgeBases];
  return delay(kb);
}

export async function updateKnowledgeBase(
  id: string,
  input: Partial<Omit<KnowledgeBase, 'id'>>,
): Promise<KnowledgeBase> {
  knowledgeBases = knowledgeBases.map((k) =>
    k.id === id ? { ...k, ...input, updatedAt: new Date().toISOString() } : k,
  );
  const updated = knowledgeBases.find((k) => k.id === id);
  if (!updated) throw new Error('Knowledge base not found');
  return delay(updated);
}
