'use client';

import { create } from 'zustand';
import {
  appendMessage,
  fetchCustomerDetail,
  getCustomer,
  listConversations,
  listCustomers,
  listMessages,
  toggleConversationStatus,
  createLead as createLeadApi,
  updateLead as updateLeadApi,
  deleteLead as deleteLeadApi,
  getLeadStats,
  type Conversation,
  type ConversationStatus,
  type Customer,
  type CustomerFilters,
  type Message,
  type LeadCreate,
  type LeadUpdate,
  type LeadStats,
} from '@/services/customers';

interface CustomerState {
  customers: Customer[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  loading: boolean;
  loadingList: boolean;
  loadingCustomer: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
  currentCustomer: Customer | null;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  aiActive: boolean;
  leadStats: LeadStats | null;
  customerFetchId: string | null;
  messagesFetchConversationId: string | null;
  lastListFilters: CustomerFilters | undefined;
  list(filters?: CustomerFilters): Promise<void>;
  selectCustomer(id: string): Promise<void>;
  fetchCustomerWithConversations(id: string): Promise<void>;
  loadConversations(customerId: string): Promise<void>;
  selectConversation(id: string): Promise<void>;
  loadMessages(conversationId: string): Promise<void>;
  sendMessage(conversationId: string, content: string): Promise<void>;
  toggleMode(conversationId: string, mode: ConversationStatus): Promise<void>;
  createLead(data: LeadCreate): Promise<Customer>;
  updateLead(id: string, data: LeadUpdate): Promise<void>;
  deleteLead(id: string): Promise<void>;
  loadLeadStats(): Promise<void>;
  resetError(): void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  total: 0,
  page: 1,
  perPage: 10,
  totalPages: 1,
  loading: false,
  loadingList: false,
  loadingCustomer: false,
  loadingMessages: false,
  sendingMessage: false,
  error: null,
  currentCustomer: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  aiActive: true,
  leadStats: null,
  customerFetchId: null,
  messagesFetchConversationId: null,
  lastListFilters: undefined,

  async list(filters) {
    set({ loading: true, loadingList: true, error: null, lastListFilters: filters });
    try {
      const data = await listCustomers(filters);
      set({
        customers: data.items,
        total: data.total,
        page: data.page,
        perPage: data.perPage,
        totalPages: data.totalPages,
        loading: false,
        loadingList: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false, loadingList: false });
    }
  },

  async selectCustomer(id) {
    set({ loading: true, loadingCustomer: true, error: null });
    try {
      const cust = await getCustomer(id);
      set({ currentCustomer: cust, loading: false, loadingCustomer: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false, loadingCustomer: false });
    }
  },

  async fetchCustomerWithConversations(id) {
    set({
      customerFetchId: id,
      currentCustomer: null,
      conversations: [],
      currentConversation: null,
      messages: [],
      loading: true,
      loadingCustomer: true,
      error: null,
    });
    try {
      const { customer, conversations } = await fetchCustomerDetail(id);
      if (get().customerFetchId !== id) return;
      set({
        currentCustomer: customer,
        conversations,
        loading: false,
        loadingCustomer: false,
        customerFetchId: null,
      });
    } catch (err) {
      if (get().customerFetchId !== id) return;
      set({
        error: (err as Error).message,
        loading: false,
        loadingCustomer: false,
        customerFetchId: null,
      });
    }
  },

  async loadConversations(customerId) {
    set({ loading: true, loadingCustomer: true, error: null });
    try {
      const convs = await listConversations(customerId);
      set({ conversations: convs, loading: false, loadingCustomer: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false, loadingCustomer: false });
    }
  },

  async selectConversation(id) {
    const conv = get().conversations.find((c) => c.id === id) || null;
    set({ currentConversation: conv });
    if (conv) {
      await get().loadMessages(conv.id);
      set({ aiActive: conv.status === 'ai' });
    }
  },

  async loadMessages(conversationId) {
    set({ messagesFetchConversationId: conversationId, loading: true, loadingMessages: true, error: null });
    try {
      const msgs = await listMessages(conversationId);
      if (get().messagesFetchConversationId !== conversationId) return;
      set({ messages: msgs, loading: false, loadingMessages: false, messagesFetchConversationId: null });
    } catch (err) {
      if (get().messagesFetchConversationId !== conversationId) return;
      set({ error: (err as Error).message, loading: false, loadingMessages: false, messagesFetchConversationId: null });
    }
  },

  async sendMessage(conversationId, content) {
    set({ loading: true, sendingMessage: true, error: null });
    try {
      await appendMessage(conversationId, 'assistant', content);
      const msgs = await listMessages(conversationId);
      set({ messages: msgs, loading: false, sendingMessage: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false, sendingMessage: false });
    }
  },

  async toggleMode(conversationId, mode) {
    await toggleConversationStatus(conversationId, mode);
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === conversationId ? { ...c, status: mode } : c)),
      currentConversation:
        state.currentConversation && state.currentConversation.id === conversationId
          ? { ...state.currentConversation, status: mode }
          : state.currentConversation,
      aiActive: mode === 'ai',
    }));
  },

  async createLead(data) {
    set({ loading: true, error: null });
    try {
      const created = await createLeadApi(data);
      await get().list(get().lastListFilters);
      set({ loading: false });
      return created;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async updateLead(id, data) {
    set({ loading: true, error: null });
    try {
      await updateLeadApi(id, data);
      if (get().currentCustomer?.id === id) {
        await get().selectCustomer(id);
      }
      await get().list(get().lastListFilters);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async deleteLead(id) {
    set({ loading: true, error: null });
    try {
      await deleteLeadApi(id);
      if (get().currentCustomer?.id === id) {
        set({ currentCustomer: null });
      }
      await get().list(get().lastListFilters);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async loadLeadStats() {
    // Don't set loading state for stats to avoid blocking UI
    try {
      const stats = await getLeadStats();
      set({ leadStats: stats });
    } catch (err) {
      // Don't set error state for stats - it's not critical
      console.warn('Failed to load lead stats:', err);
      set({ leadStats: null });
    }
  },

  resetError() {
    set({ error: null });
  },
}));
