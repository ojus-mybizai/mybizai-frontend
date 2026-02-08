import { apiFetch } from "@/lib/api-client";

export type MessageChannel = "whatsapp" | "instagram_dm" | "generic";

export interface MessageTemplate {
  id: number;
  business_id: number;
  agent_id: number | null;
  name: string;
  description: string | null;
  channel: MessageChannel | string;
  intent_key: string | null;
  body: string;
  language: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string | null;
}

export interface MessageTemplateCreate {
  agent_id?: number | null;
  name: string;
  description?: string | null;
  channel: MessageChannel | string;
  intent_key?: string | null;
  body: string;
  language?: string | null;
  is_active?: boolean;
  priority?: number;
}

export interface MessageTemplateUpdate {
  agent_id?: number | null;
  name?: string;
  description?: string | null;
  channel?: MessageChannel | string;
  intent_key?: string | null;
  body?: string;
  language?: string | null;
  is_active?: boolean;
  priority?: number;
}

export interface TemplateSelectionContext {
  agent_id?: number | null;
  channel: MessageChannel | string;
  intent_key?: string | null;
  variables?: Record<string, unknown>;
}

export interface TemplateSelectionResult {
  template_id: number;
  name: string;
  channel: MessageChannel | string;
  intent_key: string | null;
  rendered_body: string;
}

export async function listMessageTemplates(params: {
  agent_id?: number;
  channel?: string;
  intent_key?: string;
  is_active?: boolean;
} = {}): Promise<MessageTemplate[]> {
  const search = new URLSearchParams();
  if (params.agent_id != null) search.set("agent_id", String(params.agent_id));
  if (params.channel) search.set("channel", params.channel);
  if (params.intent_key) search.set("intent_key", params.intent_key);
  if (params.is_active != null) search.set("is_active", String(params.is_active));
  const qs = search.toString();
  const path = qs ? `/message-templates?${qs}` : "/message-templates";
  return apiFetch<MessageTemplate[]>(path, { method: "GET" });
}

export async function createMessageTemplate(
  data: MessageTemplateCreate,
): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>("/message-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMessageTemplate(
  id: number,
  data: MessageTemplateUpdate,
): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>(`/message-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMessageTemplate(id: number): Promise<void> {
  await apiFetch(`/message-templates/${id}`, { method: "DELETE" });
}

export async function selectMessageTemplate(
  ctx: TemplateSelectionContext,
): Promise<TemplateSelectionResult | null> {
  return apiFetch<TemplateSelectionResult | null>("/message-templates/select", {
    method: "POST",
    body: JSON.stringify(ctx),
  });
}

