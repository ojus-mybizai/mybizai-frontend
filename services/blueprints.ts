import { apiFetch } from '@/lib/api-client';

export interface BlueprintListItem {
  key: string;
  name: string;
  industry: string;
  description: string;
  systems_count: number;
}

export interface BlueprintPreview {
  key: string;
  name: string;
  industry: string;
  description: string;
  datasheets: Array<{
    key: string;
    display_name: string;
    description: string;
    fields_count: number;
  }>;
  work_templates: Array<{
    key: string;
    name: string;
    type: string;
    description: string;
  }>;
  navigation: Array<{
    group: string;
    icon?: string;
    items: Array<{
      label: string;
      type: string;
      target: string;
      icon?: string;
    }>;
  }>;
  lead_config?: Record<string, unknown> | null;
  roles?: Array<Record<string, unknown>> | null;
}

export interface ApplyBlueprintResult {
  message: string;
  datasheets_created: number;
  work_templates_created: number;
  navigation_updated: boolean;
}

export async function listBlueprints(): Promise<BlueprintListItem[]> {
  return apiFetch<BlueprintListItem[]>('/blueprints/', { method: 'GET', auth: true });
}

export async function previewBlueprint(key: string): Promise<BlueprintPreview> {
  return apiFetch<BlueprintPreview>(`/blueprints/${key}`, { method: 'GET', auth: true });
}

export async function applyBlueprint(
  blueprintKey: string,
  selectedSystems?: string[],
): Promise<ApplyBlueprintResult> {
  return apiFetch<ApplyBlueprintResult>('/blueprints/apply', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      blueprint_key: blueprintKey,
      selected_systems: selectedSystems ?? null,
    }),
  });
}

export async function getNavigationConfig(): Promise<{
  navigation: Array<Record<string, unknown>>;
  has_custom_nav: boolean;
}> {
  return apiFetch('/blueprints/navigation/config', { method: 'GET', auth: true });
}
