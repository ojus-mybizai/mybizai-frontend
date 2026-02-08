import { apiFetch } from "@/lib/api-client";

export interface TemplateField {
  name: string;
  type: string;
  label?: string | null;
  required?: boolean;
  options?: string[] | null;
  validation?: Record<string, unknown> | null;
}

export interface LeadTemplate {
  id: number;
  business_id: number | null;
  name: string;
  description: string | null;
  intent_keywords: string[] | null;
  intent_category: string | null;
  fields: TemplateField[];
  is_global: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string | null;
}

export interface LeadTemplateCreate {
  name: string;
  description?: string | null;
  intent_keywords?: string[] | null;
  intent_category?: string | null;
  fields: TemplateField[];
  is_global?: boolean;
  is_active?: boolean;
  priority?: number;
  business_id?: number | null;
}

export interface LeadTemplateUpdate {
  name?: string;
  description?: string | null;
  intent_keywords?: string[] | null;
  intent_category?: string | null;
  fields?: TemplateField[];
  is_global?: boolean;
  is_active?: boolean;
  priority?: number;
}

export async function listLeadTemplates(includeGlobal = true): Promise<LeadTemplate[]> {
  const params = new URLSearchParams();
  params.set("include_global", String(includeGlobal));
  return apiFetch<LeadTemplate[]>(`/lead-templates?${params.toString()}`, { method: "GET" });
}

export async function getLeadTemplate(id: number): Promise<LeadTemplate> {
  return apiFetch<LeadTemplate>(`/lead-templates/${id}`, { method: "GET" });
}

export async function createLeadTemplate(data: LeadTemplateCreate): Promise<LeadTemplate> {
  return apiFetch<LeadTemplate>("/lead-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLeadTemplate(id: number, data: LeadTemplateUpdate): Promise<LeadTemplate> {
  return apiFetch<LeadTemplate>(`/lead-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteLeadTemplate(id: number): Promise<void> {
  await apiFetch(`/lead-templates/${id}`, { method: "DELETE" });
}
