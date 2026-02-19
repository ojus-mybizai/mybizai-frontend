import { apiFetch } from '@/lib/api-client';

export interface KnowledgeBase {
  id: string;
  title: string;
  sourceType: 'file' | 'text';
  entries: number;
  category: string | null;
  content: string | null;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

type ApiKnowledgeBase = {
  id: number;
  title: string;
  type: 'text' | 'file';
  category?: string | null;
  content?: string | null;
  file_url?: string | null;
  created_at: string;
  updated_at: string | null;
};

export interface CreateTextKnowledgeBaseInput {
  title: string;
  category?: string;
  content: string;
}

export interface UploadKnowledgeBaseFileInput {
  title: string;
  category?: string;
  file: File;
}

export interface UpdateKnowledgeBaseInput {
  title?: string;
  category?: string | null;
  content?: string | null;
}

function mapKB(kb: ApiKnowledgeBase): KnowledgeBase {
  return {
    id: String(kb.id),
    title: kb.title,
    sourceType: kb.type === 'file' ? 'file' : 'text',
    entries:
      kb.type === 'text' && kb.content
        ? Math.max(
            1,
            kb.content
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean).length,
          )
        : 1,
    category: kb.category ?? null,
    content: kb.content ?? null,
    fileUrl: kb.file_url ?? null,
    createdAt: kb.created_at,
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

export async function createKnowledgeBase(
  input: CreateTextKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  const payload = {
    title: input.title,
    type: 'text' as const,
    category: input.category?.trim() || null,
    content: input.content,
  };
  const data = await apiFetch<ApiKnowledgeBase>('/knowledge_base/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapKB(data);
}

export async function uploadKnowledgeBaseFile(
  input: UploadKnowledgeBaseFileInput,
): Promise<KnowledgeBase> {
  const formData = new FormData();
  formData.append('title', input.title);
  if (input.category?.trim()) {
    formData.append('category', input.category.trim());
  }
  formData.append('file', input.file);

  const data = await apiFetch<ApiKnowledgeBase>('/knowledge_base/upload', {
    method: 'POST',
    body: formData,
  });
  return mapKB(data);
}

export async function updateKnowledgeBase(
  id: string,
  input: UpdateKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.category !== undefined) payload.category = input.category;
  if (input.content !== undefined) payload.content = input.content;

  const data = await apiFetch<ApiKnowledgeBase>(`/knowledge_base/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapKB(data);
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await apiFetch<void>(`/knowledge_base/${id}`, { method: 'DELETE' });
}

