import { apiFetch } from '@/lib/api-client';

export type DataSheetToolOperation = 'search' | 'create' | 'update';

export type DataSheetSearchMode = 'structured' | 'semantic';

export interface DataSheetToolConfigOut {
  id: number;
  tool_id: number;
  dynamic_model_id: number;
  operation: string;
  allowed_read_fields: string[];
  allowed_write_fields: string[];
  allowed_filter_fields: string[];
  trigger_instruction: string | null;
  max_results: number;
  search_mode: DataSheetSearchMode;
  created_at: string;
  updated_at: string | null;
}

export interface DataSheetToolOut {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  manifest: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string | null;
  config: DataSheetToolConfigOut;
  agent_ids: number[];
}

export interface DataSheetToolCreate {
  dynamic_model_id: number;
  operation: DataSheetToolOperation;
  allowed_read_fields: string[];
  allowed_write_fields: string[];
  allowed_filter_fields: string[];
  trigger_instruction?: string | null;
  max_results?: number;
  search_mode?: DataSheetSearchMode;
  agent_ids?: number[] | null;
}

export interface DataSheetToolUpdate {
  dynamic_model_id?: number;
  operation?: DataSheetToolOperation;
  allowed_read_fields?: string[];
  allowed_write_fields?: string[];
  allowed_filter_fields?: string[];
  trigger_instruction?: string | null;
  max_results?: number;
  search_mode?: DataSheetSearchMode;
  agent_ids?: number[] | null;
}

export interface DataSheetToolTestResponse {
  output: unknown;
  execution_time_ms: number;
}

export async function listDataSheetTools(): Promise<DataSheetToolOut[]> {
  return apiFetch<DataSheetToolOut[]>('/datasheet-tools/', { method: 'GET' });
}

export async function getDataSheetTool(id: number): Promise<DataSheetToolOut> {
  return apiFetch<DataSheetToolOut>(`/datasheet-tools/${id}`, { method: 'GET' });
}

export async function createDataSheetTool(payload: DataSheetToolCreate): Promise<DataSheetToolOut> {
  return apiFetch<DataSheetToolOut>('/datasheet-tools/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDataSheetTool(
  id: number,
  payload: DataSheetToolUpdate
): Promise<DataSheetToolOut> {
  return apiFetch<DataSheetToolOut>(`/datasheet-tools/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteDataSheetTool(id: number): Promise<void> {
  await apiFetch(`/datasheet-tools/${id}`, { method: 'DELETE' });
}

export async function testDataSheetTool(
  id: number,
  parameters: Record<string, unknown>
): Promise<DataSheetToolTestResponse> {
  return apiFetch<DataSheetToolTestResponse>(`/datasheet-tools/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ parameters }),
  });
}
