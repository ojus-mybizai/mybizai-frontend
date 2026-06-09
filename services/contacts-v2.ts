/**
 * contacts-v2.ts
 * Unified Contact API service — calls /api/v1/contacts-v2/*
 *
 * Contacts are organized via user-created Groups (ContactGroup).
 * Pipeline tracking uses BusinessProcess + ProcessEntry.
 */
import { apiFetch } from '@/lib/api-client';

// ── Enums / simple types ──────────────────────────────────────────────────────

export type RoutingMode = 'ai' | 'manual' | 'blocked';
export type Priority    = 'hot' | 'high' | 'medium' | 'low';
export type NoteSource  = 'manual' | 'ai';
export type NoteCategory = 'general' | 'preference' | 'complaint' | 'follow-up';

// ── ContactGroup ──────────────────────────────────────────────────────────────

export interface ContactGroup {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  ai_agent_id: number | null;
  agent_name: string | null;
  routing_mode: RoutingMode;
  member_count: number;
  is_system: boolean;
  source_key: string | null;
  created_at: string;
}

export interface ContactGroupDetail extends ContactGroup {
  members: { id: number; name: string | null; phone: string | null; email: string | null; routing_mode: string }[];
  channel_routings: ContactGroupChannelRouting[];
}

export interface ContactGroupChannelRouting {
  channel_id: number;
  channel_name: string | null;
  routing_mode: RoutingMode;
  agent_id: number | null;
}

// ── Intake routing overrides ─────────────────────────────────────────────────
// One per built-in source_key (meta_ads, whatsapp, instagram, ...). Default
// is the built-in system group; override redirects new intake to a custom
// group. Affects new contacts only.
export interface IntakeRoutingItem {
  source_key: string;
  source_label: string;
  source_description: string;
  default_group_id: number | null;
  default_group_name: string | null;
  override_group_id: number | null;
  override_group_name: string | null;
  effective_group_id: number | null;
  effective_group_name: string | null;
}

// ── Tag ───────────────────────────────────────────────────────────────────────

export interface ContactTag {
  id: number;
  name: string;
  color: string | null;
  group_id?: number | null;   // null/undefined = global; set = group-scoped
}

// ── Saved view ────────────────────────────────────────────────────────────────

export interface ContactSavedView {
  id: number;
  name: string;
  filters: ContactFilters;
  created_at: string;
}

// ── Contact (full enriched record) ────────────────────────────────────────────

export interface Contact {
  id: number;
  public_id: string | null;
  business_id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;
  contact_source: string | null;
  priority: Priority;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  routing_mode: RoutingMode;
  ai_agent_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  // enriched
  tags: ContactTag[];
  active_processes: { id: number; name?: string; stage?: string }[];
  overdue_followup_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  latest_conversation_id: number | null;
  // Custom fields — keyed by ContactFieldDef.id as string
  custom_fields: Record<string, unknown> | null;
  // IDs of the contact_groups this contact belongs to. Used by the contact
  // detail UI to filter applicable ContactFieldDef entries (global +
  // group-scoped) without N+1 round trips.
  group_ids?: number[];
  // Meta ad attribution
  ad_platform: string | null;
  meta_ad_id: string | null;
  meta_campaign_name: string | null;
  ctwa_clid: string | null;
  ad_headline: string | null;
}

// ── List response ─────────────────────────────────────────────────────────────

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  per_page: number;
}

// ── Filters ───────────────────────────────────────────────────────────────────

export interface ContactFilters {
  search?: string;
  group_id?: number | null;
  priority?: Priority | null;
  assigned_to_id?: number | null;
  routing_mode?: RoutingMode | null;
  tag_id?: number | null;
  source?: string | null;
  channel_id?: number | null;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface ContactStats {
  total: number;
  by_group: Record<string, number>;
  by_priority: Record<string, number>;
  by_source: Record<string, number>;
}

export interface ContactStatsOverTime {
  date: string;
  count: number;
}

// ── Channel info ──────────────────────────────────────────────────────────────

export interface ContactChannel {
  channel_id: number;
  channel_name: string;
  channel_type: string;
  channel_identifier: string;
  display_name: string | null;
  routing_mode: RoutingMode | null;
  agent_id: number | null;
  agent_name: string | null;
  channel_default_agent_id?: number | null;
}

/** Body for PATCH /contacts-v2/{contact_id}/channels/{channel_id}. */
export interface ContactChannelRoutingPatch {
  routing_mode?: RoutingMode | null;
  agent_id?: number | null;
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface ContactActivity {
  id: number;
  activity_type: string;
  description: string | null;
  metadata_json: Record<string, unknown> | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

// ── Note ─────────────────────────────────────────────────────────────────────

export interface ContactNote {
  id: number;
  content: string;
  category: NoteCategory;
  source: NoteSource;
  user_id: number | null;
  user_name: string | null;
  conversation_id: number | null;
  created_at: string;
}

// ── Process entry ─────────────────────────────────────────────────────────────

export interface ContactProcessEntry {
  id: number;
  process_id: number;
  process_name: string;
  process_color: string | null;
  current_stage_id: number | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  current_stage_type: string | null;
  status: string;
  title: string | null;
  priority: string | null;
  expected_value: number | null;
  expected_close_date: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  entered_at: string;
  stage_entered_at: string | null;
  completed_at: string | null;
  process_stages: { id: number; name: string; color: string | null; stage_type: string; sort_order: number }[];
}

// ── Bulk action ───────────────────────────────────────────────────────────────

export type BulkActionType = 'change_priority' | 'assign' | 'delete';

export interface BulkActionPayload {
  action: BulkActionType;
  contact_ids: number[];
  priority?: Priority;
  assigned_to_id?: number | null;
}

export interface BulkActionResult {
  affected: number;
  action: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | number | boolean | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
}

// ══════════════════════════════════════════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════════════════════════════════════════

export const contactTagService = {
  /**
   * List tags.
   * - No groupId  → global tags only
   * - groupId = X → global tags + tags scoped to group X
   */
  list: (groupId?: number | null): Promise<ContactTag[]> => {
    const qs = groupId != null ? `?group_id=${groupId}` : '';
    return apiFetch<ContactTag[]>(`/contacts-v2/tags${qs}`);
  },

  create: (payload: { name: string; color?: string; group_id?: number | null }): Promise<ContactTag> =>
    apiFetch<ContactTag>('/contacts-v2/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (tagId: number, payload: { name?: string; color?: string }): Promise<ContactTag> =>
    apiFetch<ContactTag>(`/contacts-v2/tags/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  delete: (tagId: number): Promise<void> =>
    apiFetch(`/contacts-v2/tags/${tagId}`, { method: 'DELETE' }),
};

// ══════════════════════════════════════════════════════════════════════════════
// SAVED VIEWS
// ══════════════════════════════════════════════════════════════════════════════

export const contactSavedViewService = {
  list: (): Promise<ContactSavedView[]> =>
    apiFetch<ContactSavedView[]>('/contacts-v2/saved-views'),

  create: (payload: { name: string; filters: ContactFilters }): Promise<ContactSavedView> =>
    apiFetch<ContactSavedView>('/contacts-v2/saved-views', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  delete: (viewId: number): Promise<void> =>
    apiFetch(`/contacts-v2/saved-views/${viewId}`, { method: 'DELETE' }),
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTACTS — CRUD
// ══════════════════════════════════════════════════════════════════════════════

export const contactsV2Service = {
  // ── List ──────────────────────────────────────────────────────────────────
  list: (filters: ContactFilters = {}): Promise<ContactListResponse> => {
    const perPage = filters.limit ?? 50;
    const offset  = filters.offset ?? 0;
    const page    = Math.floor(offset / perPage) + 1;
    const qs = buildQs({
      search:          filters.search,
      group_id:        filters.group_id,
      priority:        filters.priority,
      assigned_to_id:  filters.assigned_to_id,
      source:          filters.source,
      channel_id:      filters.channel_id,
      sort_by:         filters.sort_by ?? 'created_at',
      sort_dir:        filters.sort_dir ?? 'desc',
      page,
      per_page:        perPage,
    });
    return apiFetch<ContactListResponse>(`/contacts-v2?${qs}`);
  },

  // ── Single ────────────────────────────────────────────────────────────────
  get: (id: number): Promise<Contact> =>
    apiFetch<Contact>(`/contacts-v2/${id}`),

  // ── Create ────────────────────────────────────────────────────────────────
  create: (payload: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    priority?: Priority;
    routing_mode?: RoutingMode;
    ai_agent_id?: number | null;
    notes?: string;
    contact_source?: string;
  }): Promise<Contact> =>
    apiFetch<Contact>('/contacts-v2', {
      method: 'POST',
      body: JSON.stringify({ routing_mode: 'ai', priority: 'medium', ...payload }),
    }),

  // ── Update ────────────────────────────────────────────────────────────────
  update: (id: number, payload: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    priority?: Priority;
    notes?: string;
    ai_agent_id?: number | null;
  }): Promise<Contact> =>
    apiFetch<Contact>(`/contacts-v2/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // ── Delete ────────────────────────────────────────────────────────────────
  delete: (id: number): Promise<void> =>
    apiFetch(`/contacts-v2/${id}`, { method: 'DELETE' }),

  // ── Assign ────────────────────────────────────────────────────────────────
  assign: (id: number, assigned_to_id: number | null): Promise<Contact> =>
    apiFetch<Contact>(`/contacts-v2/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ assigned_to_id }),
    }),

  // ── Routing ───────────────────────────────────────────────────────────────
  updateRouting: (id: number, routing_mode: RoutingMode, ai_agent_id?: number | null): Promise<Contact> =>
    apiFetch<Contact>(`/contacts-v2/${id}/routing`, {
      method: 'PATCH',
      body: JSON.stringify({ routing_mode, ai_agent_id: ai_agent_id ?? null }),
    }),

  // ── Channels ──────────────────────────────────────────────────────────────
  getChannels: (id: number): Promise<ContactChannel[]> =>
    apiFetch<ContactChannel[]>(`/contacts-v2/${id}/channels`),

  /**
   * Update per-channel routing for one contact. Send only the fields you
   * want to change. Pass `routing_mode: null` to clear the override (revert
   * to channel default). Same with `agent_id: null`.
   */
  setChannelRouting: (
    contactId: number,
    channelId: number,
    patch: ContactChannelRoutingPatch,
  ): Promise<{
    channel_id: number;
    contact_id: number;
    channel_identifier: string;
    routing_mode: RoutingMode | null;
    agent_id: number | null;
  }> =>
    apiFetch(`/contacts-v2/${contactId}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // ── Tags ──────────────────────────────────────────────────────────────────
  addTag: (contactId: number, tagId: number): Promise<void> =>
    apiFetch(`/contacts-v2/${contactId}/tags/${tagId}`, { method: 'POST' }),

  removeTag: (contactId: number, tagId: number): Promise<void> =>
    apiFetch(`/contacts-v2/${contactId}/tags/${tagId}`, { method: 'DELETE' }),

  // ── Bulk actions ──────────────────────────────────────────────────────────
  bulkAction: (payload: BulkActionPayload): Promise<BulkActionResult> =>
    apiFetch<BulkActionResult>('/contacts-v2/bulk-action', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats: (): Promise<ContactStats> =>
    apiFetch<ContactStats>('/contacts-v2/stats'),

  getStatsOverTime: (days: number = 30): Promise<ContactStatsOverTime[]> =>
    apiFetch<ContactStatsOverTime[]>(`/contacts-v2/stats/over_time?days=${days}`),

  // ── Activity ──────────────────────────────────────────────────────────────
  getActivities: (id: number, limit = 50): Promise<ContactActivity[]> =>
    apiFetch<ContactActivity[]>(`/contacts-v2/${id}/activities?limit=${limit}`),

  // ── Notes ─────────────────────────────────────────────────────────────────
  getNotes: (id: number): Promise<ContactNote[]> =>
    apiFetch<ContactNote[]>(`/contacts-v2/${id}/notes`),

  addNote: (id: number, payload: { content: string; category?: NoteCategory }): Promise<ContactNote> =>
    apiFetch<ContactNote>(`/contacts-v2/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ source: 'manual', category: 'general', ...payload }),
    }),

  deleteNote: (contactId: number, noteId: number): Promise<void> =>
    apiFetch(`/contacts-v2/${contactId}/notes/${noteId}`, { method: 'DELETE' }),

  // ── Process entries ───────────────────────────────────────────────────────
  getProcesses: (id: number): Promise<ContactProcessEntry[]> =>
    apiFetch<ContactProcessEntry[]>(`/contacts-v2/${id}/processes`),

  addToProcess: (id: number, payload: {
    process_id: number;
    stage_id?: number | null;
    title?: string;
    priority?: Priority;
    expected_value?: number | null;
    expected_close_date?: string | null;
    notes?: string;
  }): Promise<ContactProcessEntry> =>
    apiFetch<ContactProcessEntry>(`/contacts-v2/${id}/processes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  moveProcessStage: (contactId: number, entryId: number, stageId: number): Promise<ContactProcessEntry> =>
    apiFetch<ContactProcessEntry>(`/contacts-v2/${contactId}/processes/${entryId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage_id: stageId }),
    }),

  updateProcessEntry: (contactId: number, entryId: number, payload: {
    title?: string;
    priority?: Priority;
    expected_value?: number | null;
    expected_close_date?: string | null;
    notes?: string;
    assigned_to_id?: number | null;
  }): Promise<ContactProcessEntry> =>
    apiFetch<ContactProcessEntry>(`/contacts-v2/${contactId}/processes/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  removeFromProcess: (contactId: number, entryId: number): Promise<void> =>
    apiFetch(`/contacts-v2/${contactId}/processes/${entryId}`, { method: 'DELETE' }),
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT GROUPS
// ══════════════════════════════════════════════════════════════════════════════

export const contactGroupService = {
  list: (): Promise<ContactGroup[]> =>
    apiFetch<ContactGroup[]>('/contact-groups'),

  create: (payload: { name: string; color?: string; description?: string; routing_mode?: string }): Promise<ContactGroup> =>
    apiFetch<ContactGroup>('/contact-groups', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: number, payload: { name?: string; color?: string; description?: string; routing_mode?: string }): Promise<ContactGroup> =>
    apiFetch<ContactGroup>(`/contact-groups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  delete: (id: number): Promise<void> =>
    apiFetch(`/contact-groups/${id}`, { method: 'DELETE' }),

  getDetail: (id: number): Promise<ContactGroupDetail> =>
    apiFetch<ContactGroupDetail>(`/contact-groups/${id}`),

  addMembers: (groupId: number, contactIds: number[]): Promise<ContactGroup> =>
    apiFetch<ContactGroup>(`/contact-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ contact_ids: contactIds }),
    }),

  // ── Intake routing overrides (built-in source_key → custom group) ──

  listIntakeRouting: (): Promise<{ items: IntakeRoutingItem[] }> =>
    apiFetch<{ items: IntakeRoutingItem[] }>('/contact-groups/intake-routing'),

  setIntakeRouting: (sourceKey: string, groupId: number): Promise<IntakeRoutingItem> =>
    apiFetch<IntakeRoutingItem>(`/contact-groups/intake-routing/${encodeURIComponent(sourceKey)}`, {
      method: 'PUT',
      body: JSON.stringify({ group_id: groupId }),
    }),

  clearIntakeRouting: (sourceKey: string): Promise<IntakeRoutingItem> =>
    apiFetch<IntakeRoutingItem>(`/contact-groups/intake-routing/${encodeURIComponent(sourceKey)}`, {
      method: 'DELETE',
    }),

  removeMembers: (groupId: number, contactIds: number[]): Promise<ContactGroup> =>
    apiFetch<ContactGroup>(`/contact-groups/${groupId}/members`, {
      method: 'DELETE',
      body: JSON.stringify({ contact_ids: contactIds }),
    }),

  setChannelRouting: (groupId: number, channelId: number, payload: { routing_mode: string; agent_id?: number | null }): Promise<ContactGroupChannelRouting> =>
    apiFetch<ContactGroupChannelRouting>(`/contact-groups/${groupId}/routing/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteChannelRouting: (groupId: number, channelId: number): Promise<void> =>
    apiFetch(`/contact-groups/${groupId}/routing/${channelId}`, { method: 'DELETE' }),

  applyRouting: (groupId: number, payload: { channel_id: number; routing_mode: string; agent_id?: number | null }): Promise<{ updated: number }> =>
    apiFetch<{ updated: number }>(`/contact-groups/${groupId}/apply-routing`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
