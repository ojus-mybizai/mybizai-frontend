'use client';

import { create } from 'zustand';
import {
  contactsV2Service,
  contactTagService,
  contactSavedViewService,
  contactGroupService,
  type Contact,
  type ContactFilters,
  type ContactTag,
  type ContactSavedView,
  type ContactStats,
  type ContactActivity,
  type ContactNote,
  type ContactProcessEntry,
  type BulkActionPayload,
  type ContactGroup,
  type ContactGroupDetail,
} from '@/services/contacts-v2';

// ── State shape ───────────────────────────────────────────────────────────────

interface ContactV2State {
  // List
  contacts: Contact[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  lastFilters: ContactFilters;

  // Selected contact + sub-data
  selectedId: number | null;
  selectedContact: Contact | null;
  loadingDetail: boolean;
  activities: ContactActivity[];
  notes: ContactNote[];
  processes: ContactProcessEntry[];
  loadingActivities: boolean;
  loadingNotes: boolean;
  loadingProcesses: boolean;

  // Reference data (loaded once)
  tags: ContactTag[];
  savedViews: ContactSavedView[];
  stats: ContactStats | null;
  loadingStats: boolean;

  // Groups
  groups: ContactGroup[];
  loadingGroups: boolean;

  // UI selections
  selectedIds: Set<number>;

  // Actions — list
  list(filters?: ContactFilters): Promise<void>;
  loadMore(): Promise<void>;
  refresh(): Promise<void>;

  // Actions — detail
  select(id: number): Promise<void>;
  clearSelected(): void;
  loadActivities(id: number): Promise<void>;
  loadNotes(id: number): Promise<void>;
  loadProcesses(id: number): Promise<void>;

  // Actions — CRUD
  create(payload: Parameters<typeof contactsV2Service.create>[0]): Promise<Contact>;
  update(id: number, payload: Parameters<typeof contactsV2Service.update>[1]): Promise<void>;
  remove(id: number): Promise<void>;
  assign(id: number, userId: number | null): Promise<void>;
  updateRouting(id: number, mode: 'ai' | 'manual' | 'blocked', agentId?: number | null): Promise<void>;
  addTag(contactId: number, tagId: number): Promise<void>;
  removeTag(contactId: number, tagId: number): Promise<void>;
  addNote(id: number, content: string, category?: string): Promise<void>;
  deleteNote(contactId: number, noteId: number): Promise<void>;
  moveProcessStage(contactId: number, entryId: number, stageId: number): Promise<void>;

  // Actions — bulk
  bulkAction(payload: BulkActionPayload): Promise<void>;
  toggleSelectId(id: number): void;
  selectAll(): void;
  clearSelection(): void;

  // Actions — reference data
  loadTags(groupId?: number | null): Promise<void>;
  loadSavedViews(): Promise<void>;
  loadStats(): Promise<void>;
  createTag(payload: { name: string; color?: string; group_id?: number | null }): Promise<ContactTag>;
  updateTag(tagId: number, payload: { name?: string; color?: string }): Promise<ContactTag>;
  deleteTag(tagId: number): Promise<void>;
  createSavedView(name: string, filters: ContactFilters): Promise<ContactSavedView>;
  deleteSavedView(viewId: number): Promise<void>;

  // Actions — groups
  loadGroups(): Promise<void>;
  createGroup(payload: { name: string; color?: string; description?: string; routing_mode?: string }): Promise<ContactGroup>;
  updateGroup(id: number, payload: { name?: string; color?: string; description?: string; routing_mode?: string; ai_agent_id?: number | null }): Promise<void>;
  deleteGroup(id: number): Promise<void>;
  getGroupDetail(id: number): Promise<ContactGroupDetail>;
  addToGroup(groupId: number, contactIds: number[]): Promise<void>;
  removeFromGroup(groupId: number, contactIds: number[]): Promise<void>;
  applyGroupRouting(groupId: number, channelId: number, mode: string, agentId?: number | null): Promise<{ updated: number }>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ContactFilters = {
  sort_by: 'created_at',
  sort_dir: 'desc',
  limit: 50,
  offset: 0,
};

export const useContactV2Store = create<ContactV2State>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  contacts: [],
  total: 0,
  loading: false,
  loadingMore: false,
  lastFilters: DEFAULT_FILTERS,

  selectedId: null,
  selectedContact: null,
  loadingDetail: false,
  activities: [],
  notes: [],
  processes: [],
  loadingActivities: false,
  loadingNotes: false,
  loadingProcesses: false,

  tags: [],
  savedViews: [],
  stats: null,
  loadingStats: false,

  groups: [],
  loadingGroups: false,

  selectedIds: new Set(),

  // ── List ──────────────────────────────────────────────────────────────────

  async list(filters = {}) {
    const merged = { ...DEFAULT_FILTERS, ...filters, offset: 0 };
    set({ loading: true, lastFilters: merged, selectedIds: new Set() });
    try {
      const data = await contactsV2Service.list(merged);
      set({ contacts: data.contacts, total: data.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async loadMore() {
    const { lastFilters, contacts, total, loadingMore } = get();
    if (loadingMore || contacts.length >= total) return;
    const nextFilters = { ...lastFilters, offset: contacts.length };
    set({ loadingMore: true });
    try {
      const data = await contactsV2Service.list(nextFilters);
      set(s => ({ contacts: [...s.contacts, ...data.contacts], total: data.total, loadingMore: false }));
    } catch {
      set({ loadingMore: false });
    }
  },

  async refresh() {
    const { lastFilters } = get();
    await get().list(lastFilters);
  },

  // ── Detail ────────────────────────────────────────────────────────────────

  async select(id) {
    set({ selectedId: id, loadingDetail: true, activities: [], notes: [], processes: [] });
    try {
      const contact = await contactsV2Service.get(id);
      set({ selectedContact: contact, loadingDetail: false });
    } catch {
      set({ loadingDetail: false });
    }
  },

  clearSelected() {
    set({ selectedId: null, selectedContact: null, activities: [], notes: [], processes: [] });
  },

  async loadActivities(id) {
    set({ loadingActivities: true });
    try {
      const data = await contactsV2Service.getActivities(id);
      set({ activities: data, loadingActivities: false });
    } catch {
      set({ loadingActivities: false });
    }
  },

  async loadNotes(id) {
    set({ loadingNotes: true });
    try {
      const data = await contactsV2Service.getNotes(id);
      set({ notes: data, loadingNotes: false });
    } catch {
      set({ loadingNotes: false });
    }
  },

  async loadProcesses(id) {
    set({ loadingProcesses: true });
    try {
      const data = await contactsV2Service.getProcesses(id);
      set({ processes: data, loadingProcesses: false });
    } catch {
      set({ loadingProcesses: false });
    }
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(payload) {
    const contact = await contactsV2Service.create(payload);
    await get().refresh();
    return contact;
  },

  async update(id, payload) {
    const updated = await contactsV2Service.update(id, payload);
    set(s => ({
      contacts: s.contacts.map(c => c.id === id ? updated : c),
      selectedContact: s.selectedContact?.id === id ? updated : s.selectedContact,
    }));
  },

  async remove(id) {
    await contactsV2Service.delete(id);
    set(s => ({
      contacts: s.contacts.filter(c => c.id !== id),
      total: s.total - 1,
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedContact: s.selectedContact?.id === id ? null : s.selectedContact,
    }));
  },

  async assign(id, userId) {
    const updated = await contactsV2Service.assign(id, userId);
    set(s => ({
      contacts: s.contacts.map(c => c.id === id ? updated : c),
      selectedContact: s.selectedContact?.id === id ? updated : s.selectedContact,
    }));
  },

  async updateRouting(id, mode, agentId) {
    const updated = await contactsV2Service.updateRouting(id, mode, agentId);
    set(s => ({
      contacts: s.contacts.map(c => c.id === id ? updated : c),
      selectedContact: s.selectedContact?.id === id ? updated : s.selectedContact,
    }));
  },

  async addTag(contactId, tagId) {
    await contactsV2Service.addTag(contactId, tagId);
    // Refresh selected contact to get updated tags
    if (get().selectedId === contactId) await get().select(contactId);
    await get().refresh();
  },

  async removeTag(contactId, tagId) {
    await contactsV2Service.removeTag(contactId, tagId);
    if (get().selectedId === contactId) await get().select(contactId);
    await get().refresh();
  },

  async addNote(id, content, category = 'general') {
    await contactsV2Service.addNote(id, { content, category: category as 'general' });
    await get().loadNotes(id);
  },

  async deleteNote(contactId, noteId) {
    await contactsV2Service.deleteNote(contactId, noteId);
    await get().loadNotes(contactId);
  },

  async moveProcessStage(contactId, entryId, stageId) {
    await contactsV2Service.moveProcessStage(contactId, entryId, stageId);
    await get().loadProcesses(contactId);
  },

  // ── Bulk ──────────────────────────────────────────────────────────────────

  async bulkAction(payload) {
    await contactsV2Service.bulkAction(payload);
    set({ selectedIds: new Set() });
    await get().refresh();
  },

  toggleSelectId(id) {
    set(s => {
      const next = new Set(s.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedIds: next };
    });
  },

  selectAll() {
    set(s => ({ selectedIds: new Set(s.contacts.map(c => c.id)) }));
  },

  clearSelection() {
    set({ selectedIds: new Set() });
  },

  // ── Reference data ────────────────────────────────────────────────────────

  async loadTags(groupId?: number | null) {
    const data = await contactTagService.list(groupId);
    set({ tags: data });
  },

  async loadSavedViews() {
    const data = await contactSavedViewService.list();
    set({ savedViews: data });
  },

  async loadStats() {
    if (get().loadingStats) return;
    set({ loadingStats: true });
    try {
      const data = await contactsV2Service.getStats();
      set({ stats: data, loadingStats: false });
    } catch {
      set({ loadingStats: false });
    }
  },

  async createTag(payload) {
    const tag = await contactTagService.create(payload);
    set(s => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  async updateTag(tagId: number, payload: { name?: string; color?: string }) {
    const updated = await contactTagService.update(tagId, payload);
    set(s => ({ tags: s.tags.map(t => t.id === tagId ? updated : t) }));
    return updated;
  },

  async deleteTag(tagId) {
    await contactTagService.delete(tagId);
    set(s => ({ tags: s.tags.filter(t => t.id !== tagId) }));
  },

  async createSavedView(name, filters) {
    const view = await contactSavedViewService.create({ name, filters });
    set(s => ({ savedViews: [...s.savedViews, view] }));
    return view;
  },

  async deleteSavedView(viewId) {
    await contactSavedViewService.delete(viewId);
    set(s => ({ savedViews: s.savedViews.filter(v => v.id !== viewId) }));
  },

  // ── Groups ────────────────────────────────────────────────────

  async loadGroups() {
    if (get().loadingGroups) return;
    set({ loadingGroups: true });
    try {
      const data = await contactGroupService.list();
      set({ groups: data, loadingGroups: false });
    } catch {
      set({ loadingGroups: false });
    }
  },

  async createGroup(payload) {
    const g = await contactGroupService.create(payload);
    set(s => ({ groups: [...s.groups, g] }));
    return g;
  },

  async updateGroup(id, payload) {
    const g = await contactGroupService.update(id, payload);
    set(s => ({ groups: s.groups.map(grp => grp.id === id ? g : grp) }));
  },

  async deleteGroup(id) {
    await contactGroupService.delete(id);
    set(s => ({ groups: s.groups.filter(g => g.id !== id) }));
  },

  async getGroupDetail(id) {
    return contactGroupService.getDetail(id);
  },

  async addToGroup(groupId, contactIds) {
    const updated = await contactGroupService.addMembers(groupId, contactIds);
    set(s => ({ groups: s.groups.map(g => g.id === groupId ? updated : g) }));
  },

  async removeFromGroup(groupId, contactIds) {
    const updated = await contactGroupService.removeMembers(groupId, contactIds);
    set(s => ({ groups: s.groups.map(g => g.id === groupId ? updated : g) }));
  },

  async applyGroupRouting(groupId, channelId, mode, agentId) {
    const result = await contactGroupService.applyRouting(groupId, { channel_id: channelId, routing_mode: mode, agent_id: agentId });
    await get().loadGroups();
    return result;
  },
}));
