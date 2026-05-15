import { apiFetch } from '@/lib/api-client';

export type WaTemplateType = 'simple_task' | 'whatsapp_form' | 'lead_list' | 'checklist';
export type MetaFlowStatus = 'draft' | 'published' | 'deprecated';
export type MetaTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface ButtonDef {
  id: string;
  title: string;
}

export interface WaTemplate {
  id: number;
  name: string;
  description: string | null;
  type: WaTemplateType;
  message_body: string | null;
  buttons: ButtonDef[] | null;
  flow_json: Record<string, unknown> | null;
  meta_flow_id: string | null;
  meta_flow_status: MetaFlowStatus | null;
  meta_template_name: string | null;
  meta_template_status: MetaTemplateStatus | null;
  meta_template_language: string | null;
  meta_category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface WaTemplateCreate {
  name: string;
  description?: string;
  type: WaTemplateType;
  message_body?: string;
  buttons?: ButtonDef[];
  flow_json?: Record<string, unknown>;
  meta_category?: string;
  meta_template_language?: string;
}

export interface WaTemplateUpdate {
  name?: string;
  description?: string;
  message_body?: string;
  buttons?: ButtonDef[];
  flow_json?: Record<string, unknown>;
  is_active?: boolean;
  meta_category?: string;
  meta_template_language?: string;
}

export type ButtonPresets = Record<string, ButtonDef[]>;

export async function getButtonPresets(): Promise<ButtonPresets> {
  return apiFetch('/wa/templates/presets');
}

export async function getDailyReportScaffold(): Promise<Record<string, unknown>> {
  return apiFetch('/wa/templates/scaffold/daily-report');
}

export async function createTemplate(data: WaTemplateCreate): Promise<WaTemplate> {
  return apiFetch('/wa/templates', { method: 'POST', body: JSON.stringify(data) });
}

export async function listTemplates(type?: WaTemplateType): Promise<WaTemplate[]> {
  const query = type ? `?type=${type}` : '';
  return apiFetch(`/wa/templates${query}`);
}

export async function getTemplate(id: number): Promise<WaTemplate> {
  return apiFetch(`/wa/templates/${id}`);
}

export async function updateTemplate(id: number, data: WaTemplateUpdate): Promise<WaTemplate> {
  return apiFetch(`/wa/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTemplate(id: number): Promise<void> {
  return apiFetch(`/wa/templates/${id}`, { method: 'DELETE' });
}

export async function publishFlow(id: number): Promise<{ success: boolean; flow_id: string; message: string }> {
  return apiFetch(`/wa/templates/${id}/publish-flow`, { method: 'POST' });
}
