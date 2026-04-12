import { apiFetch } from "@/lib/api-client";

export type MessageChannel = "whatsapp" | "instagram_dm" | "generic";
export type MetaStatus = "draft" | "pending" | "approved" | "rejected" | "paused" | "disabled";
export type HeaderType = "none" | "text" | "image" | "video" | "document";
export type MetaCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type ButtonType = "url" | "phone_number" | "quick_reply";

export interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface ParameterMapping {
  position: number;
  component: "header" | "body" | "button";
  source: string;
  label: string;
  button_index?: number;
}

export interface MessageTemplate {
  id: number;
  business_id: number;
  agent_id: number | null;
  name: string;
  description: string | null;
  channel: MessageChannel | string;
  category: string;
  intent_key: string | null;
  body: string;
  language: string | null;
  is_active: boolean;
  priority: number;
  // WhatsApp HSM
  header_type: HeaderType | null;
  header_content: string | null;
  footer: string | null;
  buttons: TemplateButton[] | null;
  meta_template_name: string | null;
  meta_template_id: string | null;
  meta_status: MetaStatus | null;
  meta_category: MetaCategory | null;
  rejection_reason: string | null;
  parameter_mapping: ParameterMapping[] | null;
  example_values: Record<string, string[]> | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface MessageTemplateCreate {
  agent_id?: number | null;
  name: string;
  description?: string | null;
  channel: MessageChannel | string;
  category?: string;
  intent_key?: string | null;
  body: string;
  language?: string | null;
  is_active?: boolean;
  priority?: number;
  header_type?: HeaderType | null;
  header_content?: string | null;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  meta_template_name?: string | null;
  meta_category?: MetaCategory | null;
  parameter_mapping?: ParameterMapping[] | null;
  example_values?: Record<string, string[]> | null;
}

export interface MessageTemplateUpdate extends Partial<MessageTemplateCreate> {}

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

export interface SendTemplateRequest {
  phone_number: string;
  parameter_values?: Record<string, string>;
  lead_id?: number;
  channel_id?: number;
}

// ─── CRUD ──

export async function listMessageTemplates(params: {
  agent_id?: number;
  channel?: string;
  intent_key?: string;
  is_active?: boolean;
  meta_status?: string;
} = {}): Promise<MessageTemplate[]> {
  const search = new URLSearchParams();
  if (params.agent_id != null) search.set("agent_id", String(params.agent_id));
  if (params.channel) search.set("channel", params.channel);
  if (params.intent_key) search.set("intent_key", params.intent_key);
  if (params.is_active != null) search.set("is_active", String(params.is_active));
  if (params.meta_status) search.set("meta_status", params.meta_status);
  const qs = search.toString();
  return apiFetch<MessageTemplate[]>(qs ? `/message-templates?${qs}` : "/message-templates", { method: "GET" });
}

export async function createMessageTemplate(data: MessageTemplateCreate): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>("/message-templates", { method: "POST", body: JSON.stringify(data) });
}

export async function updateMessageTemplate(id: number, data: MessageTemplateUpdate): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>(`/message-templates/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteMessageTemplate(id: number): Promise<void> {
  await apiFetch(`/message-templates/${id}`, { method: "DELETE" });
}

export async function selectMessageTemplate(ctx: TemplateSelectionContext): Promise<TemplateSelectionResult | null> {
  return apiFetch<TemplateSelectionResult | null>("/message-templates/select", { method: "POST", body: JSON.stringify(ctx) });
}

// ─── Meta Approval Workflow ──

export async function submitTemplateToMeta(id: number): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>(`/message-templates/${id}/submit-to-meta`, { method: "POST" });
}

export async function syncMetaTemplateStatus(): Promise<{ synced: number; total_checked?: number }> {
  return apiFetch<{ synced: number; total_checked?: number }>("/message-templates/sync-meta-status", { method: "POST" });
}

// ─── Send Template ──

export async function sendTemplateMessage(id: number, data: SendTemplateRequest): Promise<{ status: string; message_id?: string }> {
  return apiFetch<{ status: string; message_id?: string }>(`/message-templates/${id}/send`, { method: "POST", body: JSON.stringify(data) });
}

// ─── Send Template within a Conversation ──

export interface SendConvoTemplateData {
  template_id: number;
  parameter_values?: Record<string, string>;
  record_context?: Record<string, number>; // model_id -> record_id
}

interface ConvoMessageOut {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  timestamp: string;
}

/**
 * Send a template message inside an existing conversation.
 * The backend resolves channel, lead, and recipient from the conversation.
 * Returns the persisted Message so the UI can append it to the chat.
 */
export async function sendConvoTemplate(
  convoId: string,
  data: SendConvoTemplateData,
): Promise<{ id: string; conversationId: string; role: 'assistant'; content: string; timestamp: string }> {
  const raw = await apiFetch<ConvoMessageOut>(`/convo/${Number(convoId)}/send-template`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return {
    id: String(raw.id),
    conversationId: String(raw.conversation_id),
    role: "assistant",
    content: raw.content,
    timestamp: raw.timestamp,
  };
}
