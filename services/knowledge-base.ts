import { apiFetch } from '@/lib/api-client';

export interface KnowledgeBase {
  id: string;
  title: string;
  sourceType: 'file' | 'text';
  entries: number;
  updatedAt: string;
}

type ApiKnowledgeBase = {
  id: number;
  title: string;
  type: 'text' | 'file';
  content?: string | null;
  file_url?: string | null;
  created_at: string;
  updated_at: string | null;
};

function mapKB(kb: ApiKnowledgeBase): KnowledgeBase {
  return {
    id: String(kb.id),
    title: kb.title,
    sourceType: kb.type === 'file' ? 'file' : 'text',
    entries: kb.type === 'text' && kb.content ? Math.max(1, kb.content.split('\n').filter(Boolean).length) : 1,
    updatedAt: kb.updated_at ?? kb.created_at,
  };
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const data = await apiFetch<ApiKnowledgeBase[]>('/knowledge_base/', { method: 'GET' });
  return data.map(mapKB);
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const data = await apiFetch<ApiKnowledgeBase>(`/knowledge_base/${id}`, { method: 'GET' });
  return mapKB(data);
}

