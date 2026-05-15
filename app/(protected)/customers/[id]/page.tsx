'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ModuleGuard from '@/components/module-guard';
import { ConversationList } from '@/components/customers/conversation-list';
import { LeadScoreDisplay } from '@/components/customers/lead-score-display';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/lib/auth-store';
import { useCustomerStore } from '@/lib/customer-store';
import type { LeadUpdate } from '@/services/customers';
import { listConversationSessions, type ConversationSession, listLeadNotes, createLeadNote, deleteLeadNote, type LeadNote } from '@/services/customers';
import { listFollowups, type FollowUpMessage, sendFollowupNow, cancelFollowup, createFollowup, type FollowUpMessageCreate } from '@/services/followups';
import type { Agent } from '@/services/agents';
import type { LeadTemplate } from '@/services/lead-templates';
import type { Employee } from '@/services/employees';
import { useAgentList, useEmployeeList, useLeadTemplate } from '@/lib/hooks/use-reference-data';
import { listWork, updateWork, type Work } from '@/services/work';
import { listConversationAnalytics, type ConversationAnalyticsResponse } from '@/services/analytics';
import { DynamicLeadFieldsInput } from '@/components/customers/dynamic-lead-fields-input';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

type TabId =
  | 'overview'
  | 'details'
  | 'conversations'
  | 'followups'
  | 'work'
  | 'analytics'
  | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'work', label: 'Work' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'notes', label: 'Notes' },
];

function channelLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
}

// ─── Lead Notes Component ─────────────────────────────────────────────────────

const NOTE_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  preference: 'Preference',
  complaint: 'Complaint',
  'follow-up': 'Follow-up',
};

const NOTE_CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  preference: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  complaint: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'follow-up': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

function LeadNotesSection({ leadId, currentUserId }: { leadId: string | number; currentUserId?: number | null }) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeadNotes(leadId);
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setSaving(true);
    setErr(null);
    try {
      const note = await createLeadNote(leadId, { content: text, category });
      setNotes((prev) => [note, ...prev]);
      setContent('');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed to add note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    setDeletingId(noteId);
    try {
      await deleteLeadNote(leadId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border-color bg-card-bg shadow-sm">
      {/* Header */}
      <div className="border-b border-border-color px-5 py-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Notes{notes.length > 0 ? ` (${notes.length})` : ''}
        </h2>
      </div>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="border-b border-border-color p-4 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note about this lead — preferences, complaints, follow-up context…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
          >
            {Object.entries(NOTE_CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? 'Adding…' : '+ Add Note'}
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </form>

      {/* Notes list */}
      {loading ? (
        <div className="animate-pulse p-6 text-center text-sm text-text-secondary">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-secondary">No notes yet. Add the first one above.</div>
      ) : (
        <div className="divide-y divide-border-color">
          {notes.map((note) => (
            <div key={note.id} className="group px-5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        NOTE_CATEGORY_COLORS[note.category ?? 'general'] ??
                        'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {NOTE_CATEGORY_LABELS[note.category ?? 'general'] ?? note.category}
                    </span>
                    {note.source === 'agent' && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        🤖 AI
                      </span>
                    )}
                    <span className="text-xs text-text-secondary">
                      {note.created_at
                        ? new Date(note.created_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{note.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  disabled={deletingId === note.id}
                  className="shrink-0 rounded p-1 text-xs text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-600 disabled:opacity-50 transition-opacity"
                  title="Delete note"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentCustomer, conversations, fetchCustomerWithConversations, updateLead, toggleMode, deleteLead: deleteLeadAction } = useCustomerStore(
    useShallow((s) => ({
      currentCustomer: s.currentCustomer,
      conversations: s.conversations,
      fetchCustomerWithConversations: s.fetchCustomerWithConversations,
      updateLead: s.updateLead,
      toggleMode: s.toggleMode,
      deleteLead: s.deleteLead,
    }))
  );

  const id = params?.id;
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const currentUserId = user?.id;
  const business = useAuthStore((s) => (s.user as { businesses?: Array<{ role?: string; agents_enabled?: boolean }> } | null)?.businesses?.[0]);
  const agentsEnabled = business?.agents_enabled !== false;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAssignLeads = hasPermission('manage_leads');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<LeadUpdate>({});
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({});
  const { data: matchedTemplate = null } = useLeadTemplate(currentCustomer?.templateId ?? null);
  const [assigning, setAssigning] = useState(false);
  const [followups, setFollowups] = useState<FollowUpMessage[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupsError, setFollowupsError] = useState<string | null>(null);
  // Reference data via React Query — shared cache, not refetched on every mount
  const { data: employees = [] } = useEmployeeList();
  const { data: agents = [] } = useAgentList({ enabled: agentsEnabled });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [latestSessions, setLatestSessions] = useState<ConversationSession[]>([]);
  const [latestSessionsLoading, setLatestSessionsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState<{
    agent_id: number | '';
    channel_id: number | '';
    message_text: string;
    scheduled_at: string;
    delivery_mode: 'auto' | 'manual';
  }>({
    agent_id: '',
    channel_id: '',
    message_text: '',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    delivery_mode: 'auto',
  });
  const linkedChannels = currentCustomer?.linkedChannels ?? [];
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<Work[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [conversationAnalytics, setConversationAnalytics] = useState<ConversationAnalyticsResponse[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [assignWorkModalOpen, setAssignWorkModalOpen] = useState(false);

  /**
   * Tracks which tabs have already been fetched for the current lead.
   * Prevents redundant API calls when the user switches back to a tab
   * they already visited during this page session.
   * Reset whenever the lead `id` changes.
   */
  const loadedTabsRef = useRef<Set<TabId>>(new Set());

  // Reset loaded tabs when navigating to a different lead
  useEffect(() => {
    loadedTabsRef.current = new Set();
  }, [id]);

  // (employees and agents are now fetched via React Query hooks above — no useEffect needed)

  useEffect(() => {
    if (!id) return;
    void fetchCustomerWithConversations(id);
  }, [id, fetchCustomerWithConversations]);

  useEffect(() => {
    if (!id) return;
    const leadId = Number(id);
    if (!Number.isFinite(leadId)) return;
    let cancelled = false;
    setFollowupsLoading(true);
    setFollowupsError(null);
    listFollowups({ lead_id: leadId })
      .then((items) => {
        if (cancelled) return;
        setFollowups(items);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setFollowupsError(e instanceof Error ? e.message : 'Failed to load follow-ups');
      })
      .finally(() => {
        if (!cancelled) setFollowupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (currentCustomer) {
      if (isEditing) {
        setEditData({
          name: currentCustomer.name || undefined,
          phone: currentCustomer.phone || undefined,
          email: currentCustomer.email || undefined,
          priority: currentCustomer.priority,
          source: currentCustomer.source,
          notes: currentCustomer.notes || undefined,
        });
      } else {
        setEditData({});
      }
    }
  }, [currentCustomer, isEditing]);

  // (matchedTemplate is now fetched via useLeadTemplate React Query hook above)

  useEffect(() => {
    const latestConversation = [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    if (!latestConversation?.id) {
      setLatestSessions([]);
      return;
    }
    let cancelled = false;
    setLatestSessionsLoading(true);
    listConversationSessions(latestConversation.id)
      .then((rows) => {
        if (!cancelled) setLatestSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setLatestSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLatestSessionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversations]);

  useEffect(() => {
    if (!id || activeTab !== 'work') return;
    // Skip if already loaded for this lead — prevents refetch on every tab switch
    if (loadedTabsRef.current.has('work')) return;
    const leadId = Number(id);
    if (!Number.isFinite(leadId)) return;
    let cancelled = false;
    setWorkLoading(true);
    setWorkError(null);
    listWork({ page: 1, per_page: 50, lead_id: leadId })
      .then((res) => {
        if (!cancelled) {
          setWorkItems(res.items ?? []);
          loadedTabsRef.current.add('work');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setWorkItems([]);
          setWorkError(e instanceof Error ? e.message : 'Failed to load work items');
        }
      })
      .finally(() => {
        if (!cancelled) setWorkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id]);


  useEffect(() => {
    if (!id || activeTab !== 'analytics') return;
    // Skip if already loaded for this lead
    if (loadedTabsRef.current.has('analytics')) return;
    const leadId = Number(id);
    if (!Number.isFinite(leadId)) return;
    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();
    listConversationAnalytics({
      lead_id: leadId,
      start_date: startDate,
      end_date: endDate,
      limit: 100,
    })
      .then((rows) => {
        if (!cancelled) {
          setConversationAnalytics(rows ?? []);
          loadedTabsRef.current.add('analytics');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setConversationAnalytics([]);
          setAnalyticsError(e instanceof Error ? e.message : 'Failed to load analytics');
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id]);

  const handleSave = async () => {
    if (!id || !currentCustomer) return;
    setIsSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const systemFields: Record<string, unknown> = {};
      if (currentCustomer.leadScore !== undefined) systemFields.lead_level_score = currentCustomer.leadScore;
      if (currentCustomer.lastScoreUpdate) systemFields.last_score_update = currentCustomer.lastScoreUpdate;
      if (currentCustomer.templateId != null) systemFields._template_id = currentCustomer.templateId;
      if (currentCustomer.lastFilled) systemFields.last_filled = currentCustomer.lastFilled;
      const extraData = { ...editCustomFields, ...systemFields };

      await updateLead(id, {
        ...editData,
        extra_data: Object.keys(extraData).length > 0 ? extraData : undefined,
      });
      setIsEditing(false);
      setActionNotice('Customer details updated.');
    } catch (error) {
      console.error('Failed to update lead:', error);
      setActionError('Failed to update lead. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteLeadAction(id);
      router.push('/customers');
    } catch (error) {
      console.error('Failed to delete lead:', error);
      setActionError('Failed to delete lead. Please try again.');
    }
  };

  const handleAssignChange = async (assignedToId: number | null, forceReassign = false) => {
    if (!id) return;
    setAssigning(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const { assignLead } = await import('@/services/customers');
      await assignLead(id, assignedToId, forceReassign);
      void fetchCustomerWithConversations(id);
      setActionNotice('Assignee updated.');
    } catch (error: any) {
      const msg = error?.message || '';
      // If locked, show the lock error
      if (msg.includes('locked') || msg.includes('409')) {
        setActionError(msg);
      } else {
        console.error('Failed to update assignment:', error);
        setActionError('Failed to update assignment. Please try again.');
      }
    } finally {
      setAssigning(false);
    }
  };

  const handleWorkStatusChange = async (workId: number, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    setActionError(null);
    setActionNotice(null);
    try {
      const updated = await updateWork(workId, { status });
      setWorkItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setActionNotice(`Work #${workId} marked as ${status.replace('_', ' ')}.`);
    } catch (error) {
      console.error('Failed to update work status:', error);
      setActionError('Failed to update work status. Please try again.');
    }
  };

  if (!id) {
    return (
      <ModuleGuard module="lms">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-base text-text-secondary">Invalid customer id.</p>
        </div>
      </ModuleGuard>
    );
  }

  if (!currentCustomer) {
    return (
      <ModuleGuard module="lms">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-base text-text-secondary">Loading customer…</p>
        </div>
      </ModuleGuard>
    );
  }

  const latestConvId = conversations.length
    ? [...conversations].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0].id
    : null;
  const hasConversation = conversations.length > 0;
  const showAgentExperience = agentsEnabled && hasConversation;
  const lmsOnlyMode = !showAgentExperience;

  const phone = currentCustomer.phone?.trim();
  const email = currentCustomer.email?.trim();
  const displayName = currentCustomer.name || 'Unknown';

  return (
    <ModuleGuard module="lms">
      <div className="w-full space-y-3">
            {/* Header: name, status, priority, quick meta */}
            <div className="flex flex-col gap-3 rounded-xl border border-border-color bg-card-bg p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-text-primary">{displayName}</h1>
                  {currentCustomer.pipelineStageName && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium"
                      style={currentCustomer.pipelineStageColor ? { backgroundColor: currentCustomer.pipelineStageColor + '20', color: currentCustomer.pipelineStageColor } : { backgroundColor: '#e5e7eb', color: '#374151' }}
                    >
                      {currentCustomer.pipelineStageName}
                    </span>
                  )}
                  {currentCustomer.priority && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                        currentCustomer.priority === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                          : currentCustomer.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                      }`}
                    >
                      {currentCustomer.priority.charAt(0).toUpperCase() + currentCustomer.priority.slice(1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-text-secondary">
                  {phone && (
                    <a href={`tel:${phone}`} className="text-text-primary hover:text-accent hover:underline">
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a href={`mailto:${email}`} className="text-text-primary hover:text-accent hover:underline">
                      {email}
                    </a>
                  )}
                  {!phone && !email && <span>No contact info</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                  <span>Created {currentCustomer.createdAt ? new Date(currentCustomer.createdAt).toLocaleDateString() : '—'}</span>
                  <span>Last activity {currentCustomer.lastActivity ? new Date(currentCustomer.lastActivity).toLocaleString() : '—'}</span>
                  {currentCustomer.linkedChannels && currentCustomer.linkedChannels.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {currentCustomer.linkedChannels.map((lc) => (
                        <span
                          key={`${lc.channel_id}-${lc.channel_identifier}`}
                          className="rounded-full bg-green-100 px-2 py-0.5 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        >
                          {channelLabel(lc.channel_type)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {latestConvId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/inbox/${latestConvId}`)}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditData({
                      name: currentCustomer.name || '',
                      phone: currentCustomer.phone || '',
                      email: currentCustomer.email || '',
                      priority: currentCustomer.priority as LeadUpdate['priority'],
                      source: currentCustomer.source || '',
                    });
                    setEditCustomFields(currentCustomer.customFields || {});
                    setIsEditing(true);
                    setActiveTab('details');
                  }}
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setAssignWorkModalOpen(true)}
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                >
                  Create task
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                {actionError}
              </div>
            )}
            {actionNotice && !actionError && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {actionNotice}
              </div>
            )}

            {/* Tabs */}
            <div className="rounded-xl border border-border-color bg-card-bg">
              <div className="flex border-b border-border-color">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-w-0 px-4 py-3 text-sm font-semibold ${
                      activeTab === tab.id
                        ? 'border-b-2 border-accent text-accent'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Pipeline stage display */}
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-text-secondary">Pipeline stage</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentCustomer.pipelineStageName ? (
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
                            style={currentCustomer.pipelineStageColor ? { backgroundColor: currentCustomer.pipelineStageColor + '20', color: currentCustomer.pipelineStageColor } : { backgroundColor: '#e5e7eb', color: '#374151' }}
                          >
                            {currentCustomer.pipelineStageName}
                          </span>
                        ) : (
                          <span className="text-sm text-text-secondary">No stage assigned</span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-text-secondary">Use the pipeline board on the Leads page to move leads between stages.</p>
                    </section>

                    {/* Quick metrics row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-border-color bg-card-bg p-3">
                        <p className="text-xs uppercase tracking-wide text-text-secondary">Lead score</p>
                        <p className={`mt-1 text-2xl font-bold ${currentCustomer.leadScore != null && currentCustomer.leadScore >= 71 ? 'text-emerald-500' : currentCustomer.leadScore != null && currentCustomer.leadScore >= 31 ? 'text-amber-500' : 'text-text-primary'}`}>
                          {currentCustomer.leadScore != null ? Math.round(currentCustomer.leadScore) : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-color bg-card-bg p-3">
                        <p className="text-xs uppercase tracking-wide text-text-secondary">Conversations</p>
                        <p className="mt-1 text-2xl font-bold text-text-primary">{conversations.length}</p>
                      </div>
                      <div className="rounded-xl border border-border-color bg-card-bg p-3">
                        <p className="text-xs uppercase tracking-wide text-text-secondary">Follow-ups</p>
                        <p className="mt-1 text-2xl font-bold text-text-primary">{followups.length}</p>
                      </div>
                      <div className="rounded-xl border border-border-color bg-card-bg p-3">
                        <p className="text-xs uppercase tracking-wide text-text-secondary">Source</p>
                        <p className="mt-1 text-sm font-semibold text-text-primary capitalize truncate">
                          {currentCustomer.source ? currentCustomer.source.replace(/_/g, ' ') : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Summary grid */}
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Details</h2>
                      <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color">
                        {showAgentExperience && (
                          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="text-text-secondary">Agent</span>
                            <span className="font-medium text-text-primary">
                              {currentCustomer.assignedAgent && currentCustomer.assignedAgent !== '—' ? currentCustomer.assignedAgent : 'Unassigned'}
                            </span>
                          </div>
                        )}
                        <div className="px-4 py-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-text-secondary">Assigned to</span>
                            {(() => {
                              const isLocked = currentCustomer.assignmentLockedUntil && new Date(currentCustomer.assignmentLockedUntil) > new Date();
                              if (canAssignLeads) {
                                if (isLocked) {
                                  const lockedUntil = new Date(currentCustomer.assignmentLockedUntil!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                  const assigneeName = employees.find((e) => e.user_id === currentCustomer.assignedToId)?.name || 'Employee';
                                  return (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-text-primary">{assigneeName}</span>
                                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500" title={`Locked until ${lockedUntil}`}>
                                          🔒 Locked
                                        </span>
                                      </div>
                                      <span className="text-xs text-text-muted">Until {lockedUntil}</span>
                                      <button
                                        onClick={() => {
                                          if (confirm(`This lead is locked to ${assigneeName} until ${lockedUntil}. Force reassign?`)) {
                                            const newId = prompt('Enter new employee user ID (or leave empty to unassign):');
                                            handleAssignChange(newId ? Number(newId) : null, true);
                                          }
                                        }}
                                        disabled={assigning}
                                        className="text-xs text-accent hover:underline disabled:opacity-50"
                                      >
                                        Force Reassign
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <select
                                    value={currentCustomer.assignedToId ?? ''}
                                    onChange={(e) => handleAssignChange(e.target.value === '' ? null : Number(e.target.value))}
                                    disabled={assigning}
                                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                                  >
                                    <option value="">Unassigned</option>
                                    {employees.filter((emp) => emp.id === 0 || emp.is_active).map((emp) => (
                                      <option key={emp.user_id} value={String(emp.user_id)}>
                                        {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-text-primary">
                                    {currentCustomer.assignedToId == null ? 'Unassigned'
                                      : currentCustomer.assignedToId === currentUserId ? 'You'
                                      : employees.find((e) => e.user_id === currentCustomer.assignedToId)?.name ?? '—'}
                                  </span>
                                  {isLocked && (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">🔒</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          {currentCustomer.assignedAt && (
                            <div className="mt-1 text-right text-xs text-text-muted">
                              Assigned on {new Date(currentCustomer.assignedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-text-secondary">Priority</span>
                          <span className={`font-medium capitalize ${currentCustomer.priority === 'high' ? 'text-red-500' : currentCustomer.priority === 'medium' ? 'text-amber-500' : 'text-text-primary'}`}>
                            {currentCustomer.priority ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-text-secondary">Created</span>
                          <span className="font-medium text-text-primary">
                            {currentCustomer.createdAt ? new Date(currentCustomer.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>
                    </section>

                    {currentCustomer.lastMessagePreview && currentCustomer.lastMessagePreview !== '—' && (
                      <section>
                        <h2 className="mb-2 text-sm font-semibold text-text-secondary">Last AI summary</h2>
                        <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3 text-sm text-text-primary">
                          {currentCustomer.lastMessagePreview}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {activeTab === 'details' && (
                  <div className="space-y-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Name</label>
                          <input
                            type="text"
                            value={editData.name || ''}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Phone</label>
                          <input
                            type="tel"
                            value={editData.phone || ''}
                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Email</label>
                          <input
                            type="email"
                            value={editData.email || ''}
                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
                          <select
                            value={editData.priority || 'medium'}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                priority: e.target.value as 'low' | 'medium' | 'high',
                              })
                            }
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Source</label>
                          <select
                            value={editData.source || ''}
                            onChange={(e) => setEditData({ ...editData, source: e.target.value })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="website">Website</option>
                            <option value="referral">Referral</option>
                            <option value="walk-in">Walk-in</option>
                            <option value="ad_campaign">Ad Campaign</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        {/* Dynamic custom fields */}
                        <div className="rounded-xl border border-border-color bg-bg-secondary/40 p-4">
                          <h3 className="text-sm font-semibold text-text-secondary mb-3">Custom Fields</h3>
                          <DynamicLeadFieldsInput
                            value={editCustomFields}
                            onChange={setEditCustomFields}
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {isSaving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                            {isSaving ? 'Saving…' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <section>
                          <h2 className="mb-2 text-sm font-semibold text-text-secondary">Lead information</h2>
                          <dl className="space-y-1.5 text-base">
                            <div className="flex justify-between gap-2">
                              <dt className="text-text-secondary">Stage</dt>
                              <dd className="text-text-primary">{currentCustomer.pipelineStageName || 'None'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-text-secondary">Priority</dt>
                              <dd className="text-text-primary">{currentCustomer.priority ? currentCustomer.priority.charAt(0).toUpperCase() + currentCustomer.priority.slice(1) : 'Medium'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-text-secondary">Source</dt>
                              <dd className="text-text-primary">{currentCustomer.source ? currentCustomer.source.replace('_', ' ') : '—'}</dd>
                            </div>
                            {showAgentExperience && (
                              <>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-text-secondary">Agent</dt>
                                  <dd className="text-text-primary">{currentCustomer.assignedAgent && currentCustomer.assignedAgent !== '—' ? currentCustomer.assignedAgent : 'Unassigned'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-text-secondary">Conversations</dt>
                                  <dd className="text-text-primary">{conversations.length}</dd>
                                </div>
                              </>
                            )}
                          </dl>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditData({
                                  name: currentCustomer.name || '',
                                  phone: currentCustomer.phone || '',
                                  email: currentCustomer.email || '',
                                  priority: currentCustomer.priority as LeadUpdate['priority'],
                                  source: currentCustomer.source || '',
                                });
                                setEditCustomFields(currentCustomer.customFields || {});
                                setIsEditing(true);
                              }}
                              className="mt-3 text-sm font-semibold text-accent hover:underline"
                            >
                              Edit details
                            </button>
                          )}
                        </section>
                        <section>
                          <h2 className="mb-2 text-sm font-semibold text-text-secondary">Lead score</h2>
                          <LeadScoreDisplay score={currentCustomer.leadScore} lastUpdate={currentCustomer.lastScoreUpdate} showBreakdown />
                        </section>
                        {showAgentExperience && matchedTemplate && (
                          <section className="sm:col-span-2">
                            <h2 className="mb-2 text-sm font-semibold text-text-secondary">Matched template</h2>
                            <p className="text-base font-medium text-text-primary">{matchedTemplate.name}</p>
                            {matchedTemplate.description && <p className="mt-1 text-base text-text-secondary">{matchedTemplate.description}</p>}
                            {matchedTemplate.intent_category && <p className="mt-1 text-sm text-text-secondary">Intent: {matchedTemplate.intent_category}</p>}
                          </section>
                        )}
                        {showAgentExperience && currentCustomer.lastFilled && (
                          <section>
                            <h2 className="mb-2 text-sm font-semibold text-text-secondary">AI extraction</h2>
                            <p className="text-base text-text-secondary">Last filled: {new Date(currentCustomer.lastFilled).toLocaleString()}</p>
                          </section>
                        )}
                        <section className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-semibold text-text-secondary">Custom fields</h2>
                            <button
                              type="button"
                              onClick={() => {
                                setEditData({
                                  name: currentCustomer.name || '',
                                  phone: currentCustomer.phone || '',
                                  email: currentCustomer.email || '',
                                  priority: currentCustomer.priority as LeadUpdate['priority'],
                                  source: currentCustomer.source || '',
                                });
                                setEditCustomFields(currentCustomer.customFields || {});
                                setIsEditing(true);
                              }}
                              className="text-sm font-semibold text-accent hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                          <DynamicLeadFieldsInput
                            value={currentCustomer.customFields || {}}
                            readonly
                          />
                        </section>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'conversations' && (
                  <div className="space-y-3">
                    {latestConvId && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => router.push(`/inbox/${latestConvId}`)}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          Open latest
                        </button>
                      </div>
                    )}
                    {showAgentExperience ? (
                      <>
                        {latestSessionsLoading ? (
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">
                            Loading latest session insights…
                          </div>
                        ) : latestSessions.length > 0 ? (
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-text-primary">Latest session insights</div>
                              {latestSessions.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllSessions((v) => !v)}
                                  className="text-xs font-semibold text-accent hover:underline"
                                >
                                  {showAllSessions ? 'Show less' : `View all (${latestSessions.length})`}
                                </button>
                              )}
                            </div>
                            <div className="space-y-2 text-sm text-text-secondary">
                              {(showAllSessions ? latestSessions : latestSessions.slice(0, 3)).map((session) => (
                                <div key={session.id} className="rounded-md border border-border-color bg-card-bg px-2 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-text-primary">Session #{session.id}</span>
                                    <span className="capitalize">{session.status}</span>
                                  </div>
                                  <div className="mt-0.5">
                                    Started {new Date(session.startedAt).toLocaleString()} · {session.messagesCount} msgs
                                    {session.durationSeconds != null ? ` · ${Math.round(session.durationSeconds / 60)}m` : ''}
                                  </div>
                                  {(session.leadScore != null || session.sentiment != null) && (
                                    <div className="mt-0.5">
                                      {session.leadScore != null ? `Lead score ${session.leadScore.toFixed(1)}` : 'Lead score —'}
                                      {session.sentiment != null ? ` · Sentiment ${session.sentiment.toFixed(2)}` : ''}
                                    </div>
                                  )}
                                  {session.summary && <div className="mt-0.5 line-clamp-1">{session.summary}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <ConversationList
                          conversations={conversations}
                          onOpen={(convId) => router.push(`/inbox/${convId}`)}
                          onToggle={(convId, status) => toggleMode(convId, status)}
                        />
                      </>
                    ) : (
                      <div className="rounded-lg border border-border-color bg-bg-secondary p-4 text-base text-text-secondary">
                        {lmsOnlyMode && (
                          <p>Conversations and AI controls are available when the Business Agents add-on is enabled.</p>
                        )}
                        {!conversations.length && <p>No conversations yet. A conversation will appear when this customer sends or receives a message.</p>}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'followups' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-text-secondary">Follow-ups</h2>
                        <p className="text-xs text-text-secondary">
                          Upcoming and completed follow-up messages. <strong>Automatic</strong> = sent at scheduled time; <strong>Manual</strong> = click &quot;Send now&quot; when ready. Overdue = scheduled time has passed.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(!showCreateForm);
                          if (!showCreateForm && linkedChannels.length === 1) {
                            setCreateFormData((prev) => ({ ...prev, channel_id: linkedChannels[0].channel_id }));
                          }
                        }}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        {showCreateForm ? 'Cancel' : 'Create follow-up'}
                      </button>
                    </div>

                    {/* Create follow-up form — no agent required */}
                    {showCreateForm && (
                      <div className="rounded-xl border border-border-color bg-card-bg p-4">
                        <h3 className="mb-3 text-sm font-semibold text-text-primary">Create manual follow-up</h3>
                        <div className="space-y-3">
                          {linkedChannels.length > 0 ? (
                            <div>
                              <label htmlFor="create-channel" className="block text-sm font-medium text-text-secondary">
                                Channel <span className="text-red-500">*</span>
                              </label>
                              <select
                                id="create-channel"
                                value={createFormData.channel_id || ''}
                                onChange={(e) =>
                                  setCreateFormData({ ...createFormData, channel_id: e.target.value ? Number(e.target.value) : '' })
                                }
                                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                              >
                                <option value="">Select channel...</option>
                                {linkedChannels.map((lc) => (
                                  <option key={lc.channel_id} value={lc.channel_id}>
                                    {channelLabel(lc.channel_type)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : currentCustomer?.channel ? (
                            <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                              Channel: <span className="font-medium text-text-primary">{channelLabel(currentCustomer.channel)}</span>
                              {' '}(channel_id will be resolved from conversation when available)
                            </div>
                          ) : null}
                          <div>
                            <label htmlFor="create-message" className="block text-sm font-medium text-text-secondary">
                              Message <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              id="create-message"
                              value={createFormData.message_text}
                              onChange={(e) => setCreateFormData({ ...createFormData, message_text: e.target.value })}
                              rows={4}
                              maxLength={4000}
                              className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                              placeholder="Enter the follow-up message..."
                            />
                            <p className="mt-1 text-xs text-text-secondary">
                              {createFormData.message_text.length}/4000 characters
                            </p>
                          </div>
                          <div>
                            <label htmlFor="create-scheduled" className="block text-sm font-medium text-text-secondary">
                              Scheduled time <span className="text-red-500">*</span>
                            </label>
                            <input
                              id="create-scheduled"
                              type="datetime-local"
                              value={createFormData.scheduled_at}
                              onChange={(e) => setCreateFormData({ ...createFormData, scheduled_at: e.target.value })}
                              className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Delivery mode</label>
                            <div className="flex gap-2">
                              {(['auto', 'manual'] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setCreateFormData({ ...createFormData, delivery_mode: mode })}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    createFormData.delivery_mode === mode
                                      ? 'bg-accent text-white'
                                      : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                                  }`}
                                >
                                  {mode === 'auto' ? 'Automatic' : 'Manual review'}
                                </button>
                              ))}
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                              <strong>Automatic</strong> = sent at scheduled time by the system. <strong>Manual</strong> = not sent automatically; you must click &quot;Send now&quot; when ready.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const needsChannel = linkedChannels.length > 0;
                                if (!id || !createFormData.message_text.trim()) {
                                  setFollowupsError('Message is required.');
                                  return;
                                }
                                if (needsChannel && !createFormData.channel_id) {
                                  setFollowupsError('Please select a channel.');
                                  return;
                                }
                                setCreating(true);
                                setFollowupsError(null);
                                setActionError(null);
                                setActionNotice(null);
                                try {
                                  const payload: FollowUpMessageCreate = {
                                    lead_id: Number(id),
                                    message_text: createFormData.message_text.trim(),
                                    scheduled_at: new Date(createFormData.scheduled_at).toISOString(),
                                    delivery_mode: createFormData.delivery_mode,
                                    channel_id: createFormData.channel_id || undefined,
                                    channel_type: currentCustomer?.channel || null,
                                  };
                                  if (createFormData.agent_id) payload.agent_id = createFormData.agent_id as number;
                                  await createFollowup(payload);
                                  setShowCreateForm(false);
                                  setCreateFormData({
                                    agent_id: '',
                                    channel_id: '',
                                    message_text: '',
                                    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                    delivery_mode: 'auto',
                                  });
                                  const leadId = Number(id);
                                  if (Number.isFinite(leadId)) {
                                    const items = await listFollowups({ lead_id: leadId });
                                    setFollowups(items);
                                  }
                                  setActionNotice('Follow-up created successfully.');
                                } catch (e: unknown) {
                                  setFollowupsError(e instanceof Error ? e.message : 'Failed to create follow-up');
                                } finally {
                                  setCreating(false);
                                }
                              }}
                              disabled={
                                creating ||
                                !createFormData.message_text.trim() ||
                                (linkedChannels.length > 0 && !createFormData.channel_id)
                              }
                              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {creating ? 'Creating…' : 'Create follow-up'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreateForm(false);
                                setCreateFormData({
                                  agent_id: '',
                                  channel_id: '',
                                  message_text: '',
                                  scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                  delivery_mode: 'auto',
                                });
                                setFollowupsError(null);
                              }}
                              className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:border-accent"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {followupsLoading ? (
                      <p className="text-base text-text-secondary">Loading follow-ups…</p>
                    ) : followups.length === 0 ? (
                      <p className="text-base text-text-secondary">No follow-ups yet. They will appear here when an agent schedules them after conversations.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border-color text-sm">
                          <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Scheduled</th>
                              <th className="px-3 py-2 text-left">Channel</th>
                              <th className="px-3 py-2 text-left">Mode</th>
                              <th className="px-3 py-2 text-left">Preview</th>
                              <th className="px-3 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color">
                            {followups.map((f) => {
                              const scheduled = f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : '—';
                              const shortText = f.message_text.length > 80 ? `${f.message_text.slice(0, 77)}…` : f.message_text;
                              const isPending = f.status === 'scheduled' || f.status === 'pending_manual';
                              const canSendManual = f.status === 'pending_manual';
                              const isOverdue = isPending && f.scheduled_at && new Date(f.scheduled_at).getTime() < Date.now();
                              const statusLabels: Record<string, string> = { scheduled: 'Scheduled', pending_manual: 'Manual', sent: 'Sent', cancelled: 'Cancelled', failed: 'Failed' };
                              const statusLabel = statusLabels[f.status] ?? f.status.replace(/_/g, ' ');
                              return (
                                <tr key={f.id}>
                                  <td className="px-3 py-2 text-text-primary">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="inline-flex rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                                        {statusLabel}
                                      </span>
                                      {isOverdue && (
                                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Scheduled time has passed">
                                          Overdue
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-text-secondary">{scheduled}</td>
                                    <td className="px-3 py-2 text-text-secondary">
                                    {f.channel_type ? channelLabel(f.channel_type) : 'Default'}
                                  </td>
                                  <td className="px-3 py-2 text-text-secondary">
                                    {f.delivery_mode === 'auto'
                                      ? 'Automatic'
                                      : f.delivery_mode === 'manual'
                                        ? 'Manual'
                                        : 'Both'}
                                  </td>
                                  <td className="px-3 py-2 text-text-primary">{shortText}</td>
                                  <td className="px-3 py-2 text-text-secondary">
                                    <div className="flex flex-wrap gap-2">
                                      {canSendManual && (
                                        <button
                                          type="button"
                                          className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                                          onClick={async () => {
                                            try {
                                              const updated = await sendFollowupNow(f.id);
                                              setFollowups((prev) =>
                                                prev.map((x) => (x.id === updated.id ? updated : x)),
                                              );
                                              setActionNotice('Follow-up sent.');
                                              setActionError(null);
                                            } catch {
                                              setActionError('Failed to send follow-up. Please try again.');
                                            }
                                          }}
                                        >
                                          Send now
                                        </button>
                                      )}
                                      {isPending && (
                                        <button
                                          type="button"
                                          className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs font-semibold text-text-primary hover:border-accent"
                                          onClick={async () => {
                                            try {
                                              const updated = await cancelFollowup(f.id);
                                              setFollowups((prev) =>
                                                prev.map((x) => (x.id === updated.id ? updated : x)),
                                              );
                                              setActionNotice('Follow-up cancelled.');
                                              setActionError(null);
                                            } catch {
                                              setActionError('Failed to cancel follow-up. Please try again.');
                                            }
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {followupsError && (
                      <p className="text-xs text-red-500">{followupsError}</p>
                    )}
                  </div>
                )}

                {activeTab === 'work' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-text-secondary">Work linked to this customer</h2>
                      <Link
                        href="/work"
                        className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
                      >
                        Open work board
                      </Link>
                    </div>
                    {workLoading ? (
                      <p className="text-base text-text-secondary">Loading work items…</p>
                    ) : workItems.length === 0 ? (
                      <p className="text-base text-text-secondary">No work items linked to this customer yet.</p>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">
                            <div className="text-xs uppercase tracking-wide">Open</div>
                            <div className="mt-1 text-lg font-semibold text-text-primary">
                              {workItems.filter((w) => w.status === 'pending' || w.status === 'in_progress').length}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">
                            <div className="text-xs uppercase tracking-wide">Completed</div>
                            <div className="mt-1 text-lg font-semibold text-text-primary">
                              {workItems.filter((w) => w.status === 'completed').length}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">
                            <div className="text-xs uppercase tracking-wide">Overdue</div>
                            <div className="mt-1 text-lg font-semibold text-text-primary">
                              {workItems.filter((w) => w.due_date && new Date(w.due_date).getTime() < Date.now() && w.status !== 'completed' && w.status !== 'cancelled').length}
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-border-color text-sm">
                            <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left">Title</th>
                                <th className="px-3 py-2 text-left">Assigned</th>
                                <th className="px-3 py-2 text-left">Due</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-color">
                              {workItems.map((w) => (
                                <tr key={w.id}>
                                  <td className="px-3 py-2 text-text-primary">{w.title || w.work_type_name}</td>
                                  <td className="px-3 py-2 text-text-secondary">{w.assigned_to_name}</td>
                                  <td className="px-3 py-2 text-text-secondary">{w.due_date ? new Date(w.due_date).toLocaleDateString() : '—'}</td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={w.status}
                                      onChange={(e) => void handleWorkStatusChange(w.id, e.target.value as 'pending' | 'in_progress' | 'completed' | 'cancelled')}
                                      className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="in_progress">In progress</option>
                                      <option value="completed">Completed</option>
                                      <option value="cancelled">Cancelled</option>
                                    </select>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Link href={`/workstation?work=${w.id}`} className="text-xs font-semibold text-accent hover:underline">
                                      Open
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {workError && <p className="text-xs text-red-500">{workError}</p>}
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-text-secondary">Conversation analytics (last 90 days)</h2>
                    {analyticsLoading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-bg-secondary" />)}
                      </div>
                    ) : conversationAnalytics.length === 0 ? (
                      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-base text-text-secondary">
                        <p className="font-medium text-text-primary mb-1">No analytics yet</p>
                        <p>Conversation analytics appear after conversations are processed.</p>
                      </div>
                    ) : (() => {
                      const totalMsgs = conversationAnalytics.reduce((s, r) => s + (r.message_count ?? 0), 0);
                      const avgSentimentRows = conversationAnalytics.filter((r) => r.sentiment_score != null);
                      const avgSentiment = avgSentimentRows.length > 0
                        ? avgSentimentRows.reduce((s, r) => s + Number(r.sentiment_score), 0) / avgSentimentRows.length
                        : null;
                      const avgResponseRows = conversationAnalytics.filter((r) => r.avg_response_time != null);
                      const avgResponse = avgResponseRows.length > 0
                        ? avgResponseRows.reduce((s, r) => s + Number(r.avg_response_time), 0) / avgResponseRows.length
                        : null;
                      const needsFollowUp = conversationAnalytics.filter((r) => r.status !== 'resolved').length;

                      const sentimentData = conversationAnalytics
                        .filter((r) => r.sentiment_score != null)
                        .map((r, i) => ({ label: `Conv #${r.conversation_id}`, value: Number(r.sentiment_score), index: i }));

                      const volumeData = conversationAnalytics.map((r) => ({
                        label: `#${r.conversation_id}`,
                        messages: r.message_count ?? 0,
                        tools: r.tool_calls?.length ?? 0,
                      }));

                      return (
                        <>
                          {/* KPI row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'Conversations', value: conversationAnalytics.length },
                              { label: 'Total messages', value: totalMsgs },
                              { label: 'Avg sentiment', value: avgSentiment != null ? avgSentiment.toFixed(2) : '—' },
                              { label: 'Avg response', value: avgResponse != null ? `${avgResponse.toFixed(1)}s` : '—' },
                            ].map((kpi) => (
                              <div key={kpi.label} className="rounded-xl border border-border-color bg-card-bg p-3">
                                <p className="text-xs uppercase tracking-wide text-text-secondary">{kpi.label}</p>
                                <p className="mt-1 text-2xl font-bold text-text-primary">{kpi.value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Sentiment line chart */}
                            {sentimentData.length > 0 && (
                              <div className="rounded-xl border border-border-color bg-card-bg p-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">Sentiment over conversations</h3>
                                <ResponsiveContainer width="100%" height={180}>
                                  <LineChart data={sentimentData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                    <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                      content={({ active, payload, label }) => active && payload?.length ? (
                                        <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-xs shadow-lg">
                                          <p className="font-semibold text-text-primary mb-1">{label}</p>
                                          <p className="text-text-secondary">Sentiment: <span className="font-semibold text-text-primary">{Number(payload[0].value).toFixed(2)}</span></p>
                                        </div>
                                      ) : null}
                                    />
                                    <Line
                                      type="monotone"
                                      dataKey="value"
                                      stroke="#6366f1"
                                      strokeWidth={2}
                                      dot={{ r: 4, fill: '#6366f1' }}
                                      activeDot={{ r: 5 }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}

                            {/* Message volume bar chart */}
                            <div className="rounded-xl border border-border-color bg-card-bg p-4">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">Message volume</h3>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={volumeData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                  <Tooltip
                                    content={({ active, payload, label }) => active && payload?.length ? (
                                      <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-xs shadow-lg">
                                        <p className="font-semibold text-text-primary mb-1">{label}</p>
                                        {payload.map((p, i) => (
                                          <p key={i} className="text-text-secondary">{p.name}: <span className="font-semibold text-text-primary">{p.value}</span></p>
                                        ))}
                                      </div>
                                    ) : null}
                                  />
                                  <Bar dataKey="messages" name="Messages" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                    {volumeData.map((_, i) => (
                                      <Cell key={i} fill="#6366f1" />
                                    ))}
                                  </Bar>
                                  <Bar dataKey="tools" name="Tool calls" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Response time bar chart */}
                          {avgResponseRows.length > 0 && (
                            <div className="rounded-xl border border-border-color bg-card-bg p-4">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">Response time (s) per conversation</h3>
                              <ResponsiveContainer width="100%" height={140}>
                                <BarChart
                                  data={conversationAnalytics.map((r) => ({ label: `#${r.conversation_id}`, value: r.avg_response_time != null ? Number(r.avg_response_time) : 0 }))}
                                  margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                                  <Tooltip
                                    content={({ active, payload, label }) => active && payload?.length ? (
                                      <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-xs shadow-lg">
                                        <p className="font-semibold text-text-primary">{label}: <span className="text-text-secondary">{Number(payload[0].value).toFixed(1)}s</span></p>
                                      </div>
                                    ) : null}
                                  />
                                  <Bar dataKey="value" name="Avg response (s)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Collapsible raw table */}
                          <details className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-bg-secondary select-none">
                              Raw data ({conversationAnalytics.length} conversations)
                            </summary>
                            <div className="overflow-x-auto border-t border-border-color">
                              <table className="min-w-full divide-y divide-border-color text-sm">
                                <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Conversation</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Messages</th>
                                    <th className="px-3 py-2 text-left">Avg response</th>
                                    <th className="px-3 py-2 text-left">Sentiment</th>
                                    <th className="px-3 py-2 text-left">Tool calls</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-color">
                                  {conversationAnalytics.map((row) => (
                                    <tr key={row.id} className="hover:bg-bg-secondary/50">
                                      <td className="px-3 py-2 text-text-primary">
                                        <Link href={`/inbox/${row.conversation_id}`} className="font-semibold text-accent hover:underline">
                                          #{row.conversation_id}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2 text-text-secondary">
                                        {row.status}{row.resolution_status ? ` / ${row.resolution_status}` : ''}
                                      </td>
                                      <td className="px-3 py-2 text-text-secondary">{row.message_count}</td>
                                      <td className="px-3 py-2 text-text-secondary">
                                        {row.avg_response_time != null ? `${row.avg_response_time.toFixed(1)}s` : '—'}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={row.sentiment_score != null && row.sentiment_score > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : row.sentiment_score != null && row.sentiment_score < 0 ? 'text-red-500 font-semibold' : 'text-text-secondary'}>
                                          {row.sentiment_score != null ? row.sentiment_score.toFixed(2) : '—'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-text-secondary">{row.tool_calls.length}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>

                          {needsFollowUp > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                              {needsFollowUp} conversation{needsFollowUp > 1 ? 's' : ''} still need follow-up (not resolved).
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {analyticsError && <p className="text-xs text-red-500">{analyticsError}</p>}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Lead Notes</h2>
                      <LeadNotesSection leadId={id} currentUserId={currentUserId} />
                    </section>
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Profile Notes</h2>
                      {isEditing ? (
                        <div>
                          <textarea
                            value={editData.notes || ''}
                            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                            rows={5}
                            maxLength={2000}
                            placeholder="Add notes about this lead…"
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <p className="mt-1 text-right text-sm text-text-secondary">{(editData.notes?.length || 0)}/2000</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setIsEditing(false)}
                              className="rounded-lg border border-border-color px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={isSaving}
                              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
                          <p className="whitespace-pre-wrap text-base text-text-primary">{currentCustomer.notes || <span className="italic text-text-secondary">No notes</span>}</p>
                          <button type="button" onClick={() => setIsEditing(true)} className="mt-2 text-sm font-semibold text-accent hover:underline">
                            Edit notes
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="rounded-lg border border-border-color bg-bg-secondary p-3">
                      <h2 className="mb-1 text-sm font-semibold text-text-secondary">Notes activity</h2>
                      <p className="text-sm text-text-secondary">
                        Last updated {currentCustomer.updatedAt ? new Date(currentCustomer.updatedAt).toLocaleString() : '—'}.
                        Profile fields and custom attributes are available in the <strong>Details</strong> tab.
                      </p>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
          <AssignWorkModal
            isOpen={assignWorkModalOpen}
            onClose={() => setAssignWorkModalOpen(false)}
            initialLeadId={Number.isFinite(Number(id)) ? Number(id) : null}
            onCreated={() => {
              setActionNotice('Work item created for this customer.');
              setActionError(null);
              if (activeTab === 'work' && id) {
                const leadId = Number(id);
                if (Number.isFinite(leadId)) {
                  listWork({ page: 1, per_page: 50, lead_id: leadId })
                    .then((res) => setWorkItems(res.items ?? []))
                    .catch(() => setWorkItems([]));
                }
              }
            }}
          />
    </ModuleGuard>
  );
}
