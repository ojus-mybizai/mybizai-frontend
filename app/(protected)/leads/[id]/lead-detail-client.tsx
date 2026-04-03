'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ModuleGuard from '@/components/module-guard';
import { ConversationList } from '@/components/customers/conversation-list';
import { LeadScoreDisplay } from '@/components/customers/lead-score-display';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/lib/auth-store';
import { useCustomerStore } from '@/lib/customer-store';
import type { LeadUpdate } from '@/services/customers';
import {
  listConversationSessions,
  type ConversationSession,
  listLeadNotes,
  createLeadNote,
  deleteLeadNote,
  type LeadNote,
  listPipelineStages,
  moveLeadToStage,
  listLeadActivities,
  type LeadPipelineStage,
  type LeadActivity,
  getLinkedDatasheets,
  getLinkedRecords,
  type LinkedDatasheet,
  type LinkedRecordField,
  type LinkedRecord,
} from '@/services/customers';
import {
  listFollowups,
  type FollowUpMessage,
  sendFollowupNow,
  cancelFollowup,
  createFollowup,
  type FollowUpMessageCreate,
} from '@/services/followups';
import { type Agent, listAgents } from '@/services/agents';
import { setLeadAiAgent } from '@/services/customers';
import type { LeadTemplate } from '@/services/lead-templates';
import type { Employee } from '@/services/employees';
import { useAgentList, useEmployeeList, useLeadTemplate } from '@/lib/hooks/use-reference-data';
import { listWork, updateWork, type Work } from '@/services/work';
import { DynamicLeadFieldsInput } from '@/components/customers/dynamic-lead-fields-input';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type TabId = string; // dynamic — 'timeline' | 'conversations' | 'followups' | 'work' | 'ds_{model_id}'

const BASE_TABS: { id: string; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'work', label: 'Work' },
];

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

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  contacted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(d: string | undefined | null): string {
  if (!d) return '\u2014';
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function capitalize(s: string | undefined | null): string {
  if (!s) return '\u2014';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function channelLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
}

// Merge activities + notes into a unified timeline
interface TimelineEntry {
  id: string;
  type: 'activity' | 'note';
  date: string;
  icon: string;
  iconColor: string;
  title: string;
  description?: string;
  actor?: string | null;
  category?: string | null;
  noteId?: number;
  noteSource?: string;
}

function buildTimeline(activities: LeadActivity[], notes: LeadNote[]): TimelineEntry[] {
  const items: TimelineEntry[] = [];

  for (const a of activities) {
    let icon = '~';
    let iconColor = 'bg-blue-500';
    if (a.activity_type === 'stage_change' || a.activity_type === 'status_change') {
      icon = '\u2191'; iconColor = 'bg-indigo-500';
    } else if (a.activity_type === 'assignment_change') {
      icon = '\u2192'; iconColor = 'bg-purple-500';
    } else if (a.activity_type === 'followup_sent') {
      icon = '\u2709'; iconColor = 'bg-teal-500';
    } else if (a.activity_type === 'message_received' || a.activity_type === 'message_sent') {
      icon = '\u25AC'; iconColor = 'bg-green-500';
    }
    items.push({
      id: `act-${a.id}`,
      type: 'activity',
      date: a.created_at ?? '',
      icon, iconColor,
      title: a.description ?? a.activity_type.replace(/_/g, ' '),
      actor: a.user_name,
    });
  }

  for (const n of notes) {
    items.push({
      id: `note-${n.id}`,
      type: 'note',
      date: n.created_at ?? '',
      icon: '\u270E',
      iconColor: 'bg-amber-500',
      title: 'Note added',
      description: n.content,
      actor: n.source === 'agent' ? 'AI Agent' : undefined,
      category: n.category,
      noteId: n.id,
      noteSource: n.source,
    });
  }

  items.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });
  return items;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeadDetailClientProps {
  leadId: string;
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function LeadDetailClient({ leadId }: LeadDetailClientProps) {
  const router = useRouter();
  const id = leadId;

  const {
    currentCustomer,
    conversations,
    fetchCustomerWithConversations,
    updateLead,
    toggleMode,
    deleteLead: deleteLeadAction,
  } = useCustomerStore(
    useShallow((s) => ({
      currentCustomer: s.currentCustomer,
      conversations: s.conversations,
      fetchCustomerWithConversations: s.fetchCustomerWithConversations,
      updateLead: s.updateLead,
      toggleMode: s.toggleMode,
      deleteLead: s.deleteLead,
    })),
  );

  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const currentUserId = user?.id;
  const business = useAuthStore(
    (s) => (s.user as { businesses?: Array<{ role?: string; agents_enabled?: boolean }> } | null)?.businesses?.[0],
  );
  const agentsEnabled = business?.agents_enabled !== false;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAssignLeads = hasPermission('manage_leads');

  // --- State ---
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<LeadUpdate>({});
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({});

  // More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Sidebar
  const [pipelineStages, setPipelineStages] = useState<LeadPipelineStage[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [switchingAgent, setSwitchingAgent] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customFieldsExpanded, setCustomFieldsExpanded] = useState(false);

  // Timeline
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('general');
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  // Linked datasheets
  const [linkedDatasheets, setLinkedDatasheets] = useState<LinkedDatasheet[]>([]);
  const [dsRecords, setDsRecords] = useState<Record<number, { fields: LinkedRecordField[]; records: LinkedRecord[] }>>({});
  const [dsLoading, setDsLoading] = useState<number | null>(null);

  // Conversations
  const [latestSessions, setLatestSessions] = useState<ConversationSession[]>([]);
  const [latestSessionsLoading, setLatestSessionsLoading] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Follow-ups
  const [followups, setFollowups] = useState<FollowUpMessage[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupsError, setFollowupsError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    agent_id: '' as number | '',
    channel_id: '' as number | '',
    message_text: '',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    delivery_mode: 'auto' as 'auto' | 'manual',
  });

  // Work
  const [workItems, setWorkItems] = useState<Work[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [assignWorkModalOpen, setAssignWorkModalOpen] = useState(false);

  // Reference data
  const { data: employees = [] } = useEmployeeList();
  const { data: agents = [] } = useAgentList({ enabled: agentsEnabled });

  const loadedTabsRef = useRef<Set<TabId>>(new Set());
  const linkedChannels = currentCustomer?.linkedChannels ?? [];

  // --- Effects ---

  useEffect(() => { loadedTabsRef.current = new Set(); }, [id]);

  useEffect(() => {
    if (!id) return;
    void fetchCustomerWithConversations(id);
  }, [id, fetchCustomerWithConversations]);

  // Pipeline stages
  useEffect(() => {
    listPipelineStages().then(setPipelineStages).catch(() => setPipelineStages([]));
    listAgents().then(setAllAgents).catch(() => setAllAgents([]));
  }, []);

  // Linked datasheets
  useEffect(() => {
    if (!id) return;
    getLinkedDatasheets(id).then(setLinkedDatasheets).catch(() => setLinkedDatasheets([]));
  }, [id]);

  // Build dynamic tabs (base + datasheet tabs)
  const allTabs = [...BASE_TABS, ...linkedDatasheets.map(ds => ({
    id: `ds_${ds.model_id}`,
    label: ds.display_name,
    count: ds.record_count,
  }))];

  // Timeline data (activities + notes) on mount
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      listLeadActivities(id).catch(() => [] as LeadActivity[]),
      listLeadNotes(id).catch(() => [] as LeadNote[]),
    ]).then(([acts, nts]) => {
      if (cancelled) return;
      setActivities(acts);
      setNotes(nts);
    });
    return () => { cancelled = true; };
  }, [id]);

  // Follow-ups on mount
  useEffect(() => {
    if (!id) return;
    const leadId = Number(id);
    if (!Number.isFinite(leadId)) return;
    let cancelled = false;
    setFollowupsLoading(true);
    listFollowups({ lead_id: leadId })
      .then((items) => { if (!cancelled) setFollowups(items); })
      .catch((e: unknown) => { if (!cancelled) setFollowupsError(e instanceof Error ? e.message : 'Failed to load follow-ups'); })
      .finally(() => { if (!cancelled) setFollowupsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Latest sessions for conversations tab
  useEffect(() => {
    const latestConversation = [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    if (!latestConversation?.id) { setLatestSessions([]); return; }
    let cancelled = false;
    setLatestSessionsLoading(true);
    listConversationSessions(latestConversation.id)
      .then((rows) => { if (!cancelled) setLatestSessions(rows); })
      .catch(() => { if (!cancelled) setLatestSessions([]); })
      .finally(() => { if (!cancelled) setLatestSessionsLoading(false); });
    return () => { cancelled = true; };
  }, [conversations]);

  // Lazy-load work items
  useEffect(() => {
    if (!id || activeTab !== 'work') return;
    if (loadedTabsRef.current.has('work')) return;
    const leadId = Number(id);
    if (!Number.isFinite(leadId)) return;
    let cancelled = false;
    setWorkLoading(true);
    setWorkError(null);
    listWork({ page: 1, per_page: 50, lead_id: leadId })
      .then((res) => { if (!cancelled) { setWorkItems(res.items ?? []); loadedTabsRef.current.add('work'); } })
      .catch((e: unknown) => { if (!cancelled) { setWorkItems([]); setWorkError(e instanceof Error ? e.message : 'Failed to load work items'); } })
      .finally(() => { if (!cancelled) setWorkLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, id]);

  // --- Handlers ---

  const handleSave = async () => {
    if (!id || !currentCustomer) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const systemFields: Record<string, unknown> = {};
      if (currentCustomer.leadScore !== undefined) systemFields.lead_level_score = currentCustomer.leadScore;
      if (currentCustomer.lastScoreUpdate) systemFields.last_score_update = currentCustomer.lastScoreUpdate;
      if (currentCustomer.templateId != null) systemFields._template_id = currentCustomer.templateId;
      if (currentCustomer.lastFilled) systemFields.last_filled = currentCustomer.lastFilled;
      const extraData = { ...editCustomFields, ...systemFields };
      // Strip empty strings — backend validates email as EmailStr and rejects ''
      const cleanedEditData = Object.fromEntries(
        Object.entries(editData).filter(([, v]) => v !== '' && v != null)
      );
      await updateLead(id, { ...cleanedEditData, extra_data: Object.keys(extraData).length > 0 ? extraData : undefined });
      setIsEditing(false);
      setNotice('Lead updated.');
    } catch {
      setError('Failed to update lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this lead? This cannot be undone.')) return;
    try {
      await deleteLeadAction(id);
      router.push('/leads');
    } catch {
      setError('Failed to delete lead.');
    }
  };


  const handlePipelineMove = async (stageId: number) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await moveLeadToStage(id, stageId);
      void fetchCustomerWithConversations(id);
      setNotice('Pipeline stage updated.');
    } catch {
      setError('Failed to move pipeline stage.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignChange = async (assignedToId: number | null, forceReassign = false) => {
    if (!id) return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      const { assignLead } = await import('@/services/customers');
      await assignLead(id, assignedToId, forceReassign);
      void fetchCustomerWithConversations(id);
      setNotice('Assignee updated.');
    } catch (err: any) {
      const msg = err?.message || '';
      setError(msg.includes('locked') || msg.includes('409') ? msg : 'Failed to update assignment.');
    } finally {
      setAssigning(false);
    }
  };

  const handleSwitchAiAgent = async (agentId: number | null) => {
    if (!id) return;
    setSwitchingAgent(true);
    setError(null);
    try {
      await setLeadAiAgent(id, agentId);
      void fetchCustomerWithConversations(id);
      setNotice(agentId ? 'AI Agent updated.' : 'AI Agent removed.');
    } catch {
      setError('Failed to switch AI agent.');
    } finally {
      setSwitchingAgent(false);
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    setAddingNote(true);
    setError(null);
    try {
      const note = await createLeadNote(id, { content: newNote.trim(), category: newNoteCategory });
      setNotes((prev) => [note, ...prev]);
      setNewNote('');
      setNotice('Note added.');
    } catch {
      setError('Failed to add note.');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!id) return;
    setDeletingNoteId(noteId);
    try {
      await deleteLeadNote(id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { /* silent */ }
    finally { setDeletingNoteId(null); }
  };

  const handleWorkStatusChange = async (workId: number, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    setError(null);
    setNotice(null);
    try {
      const updated = await updateWork(workId, { status });
      setWorkItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setNotice(`Work #${workId} marked as ${status.replace('_', ' ')}.`);
    } catch {
      setError('Failed to update work status.');
    }
  };

  const handleCreateFollowup = async () => {
    const needsChannel = linkedChannels.length > 0;
    if (!id || !createFormData.message_text.trim()) { setFollowupsError('Message is required.'); return; }
    if (needsChannel && !createFormData.channel_id) { setFollowupsError('Please select a channel.'); return; }
    setCreating(true);
    setFollowupsError(null);
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
      setCreateFormData({ agent_id: '', channel_id: '', message_text: '', scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), delivery_mode: 'auto' });
      const leadId = Number(id);
      if (Number.isFinite(leadId)) { const items = await listFollowups({ lead_id: leadId }); setFollowups(items); }
      setNotice('Follow-up created.');
    } catch (e: unknown) {
      setFollowupsError(e instanceof Error ? e.message : 'Failed to create follow-up');
    } finally {
      setCreating(false);
    }
  };

  // --- Derived ---

  if (!id) {
    return <ModuleGuard module="lms"><div className="p-6 text-text-secondary">Invalid customer ID.</div></ModuleGuard>;
  }
  if (!currentCustomer) {
    return (
      <ModuleGuard module="lms">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </ModuleGuard>
    );
  }

  const latestConvId = conversations.length
    ? [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0].id
    : null;
  const hasConversation = conversations.length > 0;
  const showAgentExperience = agentsEnabled && hasConversation;
  const phone = currentCustomer.phone?.trim();
  const email = currentCustomer.email?.trim();
  const displayName = currentCustomer.name || phone || 'Unknown';
  const timeline = buildTimeline(activities, notes);

  // Pipeline stages: use custom pipeline if available, otherwise fallback to status
  const hasPipelineStages = pipelineStages.length > 0;

  return (
    <ModuleGuard module="lms">
      <div className="flex flex-col h-full min-h-0">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-border-color bg-card-bg">
          <button
            type="button"
            onClick={() => router.back()}
            className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            title="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">{displayName}</h1>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              {phone && <a href={`tel:${phone}`} className="hover:text-accent transition-colors">{phone}</a>}
              {email && <a href={`mailto:${email}`} className="hover:text-accent transition-colors truncate">{email}</a>}
              {!phone && !email && <span>No contact info</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-medium text-text-primary hover:border-accent transition-colors"
              >
                <span aria-hidden>&#128222;</span> Call
              </a>
            )}
            {latestConvId && (
              <button
                type="button"
                onClick={() => router.push(`/conversations/${latestConvId}`)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <span aria-hidden>&#128172;</span> Message
              </button>
            )}
            {/* More menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((v) => !v)}
                className="rounded-lg border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border-color bg-card-bg shadow-lg py-1">
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                      onClick={() => {
                        setShowMoreMenu(false);
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
                    >
                      Edit Lead
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                      onClick={() => { setShowMoreMenu(false); setAssignWorkModalOpen(true); }}
                    >
                      Create Task
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-bg-secondary"
                      onClick={() => { setShowMoreMenu(false); void handleDelete(); }}
                    >
                      Delete Lead
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notices */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
            <button type="button" onClick={() => setError(null)} className="ml-2 font-semibold hover:underline">Dismiss</button>
          </div>
        )}
        {notice && !error && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="ml-2 font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        {/* ── EDIT MODAL OVERLAY ────────────────────────────────────── */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg mx-4 rounded-xl border border-border-color bg-card-bg shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
                <h2 className="text-base font-semibold text-text-primary">Edit Lead</h2>
                <button type="button" onClick={() => setIsEditing(false)} className="text-text-secondary hover:text-text-primary text-lg">&times;</button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Name', key: 'name', type: 'text' },
                  { label: 'Phone', key: 'phone', type: 'tel' },
                  { label: 'Email', key: 'email', type: 'email' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
                    <input
                      type={type}
                      value={(editData as any)[key] || ''}
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Priority</label>
                    <select value={editData.priority || 'medium'} onChange={(e) => setEditData({ ...editData, priority: e.target.value as LeadUpdate['priority'] })} className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
                      {['low', 'medium', 'high'].map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Source</label>
                  <select value={editData.source || ''} onChange={(e) => setEditData({ ...editData, source: e.target.value })} className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
                    {['whatsapp', 'website', 'referral', 'walk-in', 'ad_campaign', 'other'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="rounded-lg border border-border-color bg-bg-secondary/40 p-3">
                  <h3 className="text-sm font-semibold text-text-secondary mb-2">Custom Fields</h3>
                  <DynamicLeadFieldsInput value={editCustomFields} onChange={setEditCustomFields} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent">Cancel</button>
                  <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    {saving ? 'Saving\u2026' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2-COLUMN LAYOUT ──────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0 overflow-hidden">
          {/* ── LEFT: TABS + CONTENT ──────────────────────────────── */}
          <div className="flex flex-col min-h-0 overflow-y-auto">
            {/* Tab bar */}
            <div className="flex border-b border-border-color bg-card-bg sticky top-0 z-10">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Load datasheet records when tab is clicked
                    if (tab.id.startsWith('ds_') && id) {
                      const modelId = Number(tab.id.replace('ds_', ''));
                      if (!dsRecords[modelId]) {
                        setDsLoading(modelId);
                        getLinkedRecords(id, modelId)
                          .then((res) => setDsRecords(prev => ({ ...prev, [modelId]: res })))
                          .catch(() => {})
                          .finally(() => setDsLoading(null));
                      }
                    }
                  }}
                  className={`px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-b-2 border-accent text-accent'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                  {'count' in tab && typeof (tab as { count?: number }).count === 'number' && (
                    <span className="ml-1.5 rounded-full bg-bg-secondary px-1.5 py-0.5 text-xs">
                      {(tab as { count: number }).count}
                    </span>
                  )}
                  {tab.id === 'followups' && followups.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-bg-secondary px-1.5 py-0.5 text-xs">{followups.length}</span>
                  )}
                  {tab.id === 'work' && workItems.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-bg-secondary px-1.5 py-0.5 text-xs">{workItems.length}</span>
                  )}
                </button>
              ))}
              {/* Mobile sidebar toggle */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="ml-auto px-3 py-3 text-sm font-semibold text-text-secondary hover:text-text-primary lg:hidden"
              >
                {sidebarCollapsed ? 'Show Info' : 'Hide Info'}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 p-4 sm:p-5">
              {/* ── TIMELINE TAB ──────────────────────────────── */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {/* Add note inline */}
                  <div className="rounded-lg border border-border-color bg-card-bg p-3">
                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about this lead..."
                        rows={2}
                        className="flex-1 resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={newNoteCategory}
                        onChange={(e) => setNewNoteCategory(e.target.value)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                      >
                        {Object.entries(NOTE_CATEGORY_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={addingNote || !newNote.trim()}
                        className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {addingNote ? 'Adding\u2026' : 'Add Note'}
                      </button>
                    </div>
                  </div>

                  {/* Timeline feed */}
                  {timeline.length === 0 ? (
                    <div className="text-center py-10 text-sm text-text-secondary">
                      No activity yet. Add a note above to get started.
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border-color" />
                      <div className="space-y-4">
                        {timeline.map((entry) => (
                          <div key={entry.id} className="relative flex gap-3 pl-0">
                            {/* Dot */}
                            <div className={`relative z-10 mt-1 h-7 w-7 shrink-0 rounded-full ${entry.iconColor} flex items-center justify-center text-white text-xs font-bold`}>
                              {entry.type === 'note' ? '\u270E' : '\u2022'}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-sm font-medium text-text-primary">{entry.title}</span>
                                {entry.category && entry.type === 'note' && (
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NOTE_CATEGORY_COLORS[entry.category] ?? NOTE_CATEGORY_COLORS.general}`}>
                                    {NOTE_CATEGORY_LABELS[entry.category] ?? entry.category}
                                  </span>
                                )}
                                {entry.noteSource === 'agent' && (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">AI</span>
                                )}
                              </div>
                              {entry.description && (
                                <p className="mt-0.5 text-sm text-text-secondary whitespace-pre-wrap break-words line-clamp-3">
                                  {entry.description}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                                {entry.actor && <span>by {entry.actor}</span>}
                                <span>{relativeTime(entry.date)}</span>
                                {entry.type === 'note' && entry.noteId && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(entry.noteId!)}
                                    disabled={deletingNoteId === entry.noteId}
                                    className="text-text-secondary hover:text-red-500 disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CONVERSATIONS TAB ──────────────────────────── */}
              {activeTab === 'conversations' && (
                <div className="space-y-3">
                  {latestConvId && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => router.push(`/conversations/${latestConvId}`)}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        Open latest
                      </button>
                    </div>
                  )}
                  {showAgentExperience ? (
                    <>
                      {latestSessionsLoading ? (
                        <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">Loading latest session insights\u2026</div>
                      ) : latestSessions.length > 0 ? (
                        <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-text-primary">Latest session insights</div>
                            {latestSessions.length > 3 && (
                              <button type="button" onClick={() => setShowAllSessions((v) => !v)} className="text-xs font-semibold text-accent hover:underline">
                                {showAllSessions ? 'Show less' : `View all (${latestSessions.length})`}
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 text-sm text-text-secondary">
                            {(showAllSessions ? latestSessions : latestSessions.slice(0, 3)).map((session) => (
                              <div key={session.id} className="rounded-md border border-border-color bg-card-bg px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-text-primary">Session #{session.id}</span>
                                  <span className="capitalize text-xs">{session.status}</span>
                                </div>
                                <div className="mt-0.5 text-xs">
                                  Started {new Date(session.startedAt).toLocaleString()} &middot; {session.messagesCount} msgs
                                  {session.durationSeconds != null ? ` \u00b7 ${Math.round(session.durationSeconds / 60)}m` : ''}
                                </div>
                                {(session.leadScore != null || session.sentiment != null) && (
                                  <div className="mt-0.5 text-xs">
                                    {session.leadScore != null ? `Score ${session.leadScore.toFixed(1)}` : ''}
                                    {session.sentiment != null ? ` \u00b7 Sentiment ${session.sentiment.toFixed(2)}` : ''}
                                  </div>
                                )}
                                {session.summary && <div className="mt-0.5 text-xs line-clamp-1">{session.summary}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <ConversationList
                        conversations={conversations}
                        onOpen={(convId) => router.push(`/conversations/${convId}`)}
                        onToggle={(convId, status) => toggleMode(convId, status)}
                      />
                    </>
                  ) : (
                    <div className="rounded-lg border border-border-color bg-bg-secondary p-4 text-sm text-text-secondary">
                      {!conversations.length && <p>No conversations yet. A conversation will appear when this customer sends or receives a message.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ── FOLLOW-UPS TAB ─────────────────────────────── */}
              {activeTab === 'followups' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-text-secondary">Follow-ups</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(!showCreateForm);
                        if (!showCreateForm && linkedChannels.length === 1) {
                          setCreateFormData((prev) => ({ ...prev, channel_id: linkedChannels[0].channel_id }));
                        }
                      }}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {showCreateForm ? 'Cancel' : '+ New Follow-up'}
                    </button>
                  </div>

                  {showCreateForm && (
                    <div className="rounded-lg border border-border-color bg-card-bg p-4 space-y-3">
                      {linkedChannels.length > 0 ? (
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Channel *</label>
                          <select
                            value={createFormData.channel_id || ''}
                            onChange={(e) => setCreateFormData({ ...createFormData, channel_id: e.target.value ? Number(e.target.value) : '' })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                          >
                            <option value="">Select channel...</option>
                            {linkedChannels.map((lc) => (
                              <option key={lc.channel_id} value={lc.channel_id}>{channelLabel(lc.channel_type)}</option>
                            ))}
                          </select>
                        </div>
                      ) : currentCustomer?.channel ? (
                        <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                          Channel: <span className="font-medium text-text-primary">{channelLabel(currentCustomer.channel)}</span>
                        </div>
                      ) : null}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Message *</label>
                        <textarea
                          value={createFormData.message_text}
                          onChange={(e) => setCreateFormData({ ...createFormData, message_text: e.target.value })}
                          rows={3}
                          maxLength={4000}
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                          placeholder="Enter the follow-up message..."
                        />
                        <p className="mt-0.5 text-xs text-text-secondary text-right">{createFormData.message_text.length}/4000</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Scheduled time *</label>
                          <input
                            type="datetime-local"
                            value={createFormData.scheduled_at}
                            onChange={(e) => setCreateFormData({ ...createFormData, scheduled_at: e.target.value })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">Delivery</label>
                          <div className="flex gap-2 mt-1">
                            {(['auto', 'manual'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setCreateFormData({ ...createFormData, delivery_mode: mode })}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  createFormData.delivery_mode === mode
                                    ? 'bg-accent text-white'
                                    : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent'
                                }`}
                              >
                                {mode === 'auto' ? 'Automatic' : 'Manual'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCreateFollowup}
                          disabled={creating || !createFormData.message_text.trim() || (linkedChannels.length > 0 && !createFormData.channel_id)}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          {creating ? 'Creating\u2026' : 'Create'}
                        </button>
                        <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:border-accent">
                          Cancel
                        </button>
                      </div>
                      {followupsError && <p className="text-xs text-red-500">{followupsError}</p>}
                    </div>
                  )}

                  {followupsLoading ? (
                    <p className="text-sm text-text-secondary">Loading follow-ups\u2026</p>
                  ) : followups.length === 0 ? (
                    <div className="text-center py-8 text-sm text-text-secondary">No follow-ups yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {followups.map((f) => {
                        const isPending = f.status === 'scheduled' || f.status === 'pending_manual';
                        const canSendManual = f.status === 'pending_manual';
                        const isOverdue = isPending && f.scheduled_at && new Date(f.scheduled_at).getTime() < Date.now();
                        const statusLabels: Record<string, string> = { scheduled: 'Scheduled', pending_manual: 'Manual', sent: 'Sent', cancelled: 'Cancelled', failed: 'Failed' };
                        return (
                          <div key={f.id} className="rounded-lg border border-border-color bg-card-bg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    f.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : f.status === 'cancelled' || f.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {statusLabels[f.status] ?? f.status}
                                  </span>
                                  {isOverdue && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Overdue</span>
                                  )}
                                  <span className="text-xs text-text-secondary">
                                    {f.channel_type ? channelLabel(f.channel_type) : 'Default'} &middot; {f.delivery_mode === 'auto' ? 'Auto' : 'Manual'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-text-primary line-clamp-2">{f.message_text}</p>
                                <p className="mt-0.5 text-xs text-text-secondary">
                                  Scheduled: {f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : '\u2014'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {canSendManual && (
                                  <button
                                    type="button"
                                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                                    onClick={async () => {
                                      try {
                                        const updated = await sendFollowupNow(f.id);
                                        setFollowups((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                                        setNotice('Follow-up sent.');
                                      } catch { setError('Failed to send follow-up.'); }
                                    }}
                                  >
                                    Send now
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-border-color px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-red-400 hover:text-red-500"
                                    onClick={async () => {
                                      try {
                                        const updated = await cancelFollowup(f.id);
                                        setFollowups((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                                        setNotice('Follow-up cancelled.');
                                      } catch { setError('Failed to cancel follow-up.'); }
                                    }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── WORK TAB ───────────────────────────────────── */}
              {activeTab === 'work' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-text-secondary">Work Items</h2>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAssignWorkModalOpen(true)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">+ Create Task</button>
                      <Link href="/work" className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent">Open Board</Link>
                    </div>
                  </div>
                  {workLoading ? (
                    <p className="text-sm text-text-secondary">Loading work items\u2026</p>
                  ) : workItems.length === 0 ? (
                    <div className="text-center py-8 text-sm text-text-secondary">No work items linked to this lead yet.</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Open', count: workItems.filter((w) => w.status === 'pending' || w.status === 'in_progress').length, color: 'text-blue-600 dark:text-blue-400' },
                          { label: 'Completed', count: workItems.filter((w) => w.status === 'completed').length, color: 'text-emerald-600 dark:text-emerald-400' },
                          { label: 'Overdue', count: workItems.filter((w) => w.due_date && new Date(w.due_date).getTime() < Date.now() && w.status !== 'completed' && w.status !== 'cancelled').length, color: 'text-red-600 dark:text-red-400' },
                        ].map((s) => (
                          <div key={s.label} className="rounded-lg border border-border-color bg-card-bg p-3 text-center">
                            <div className="text-xs uppercase tracking-wide text-text-secondary">{s.label}</div>
                            <div className={`mt-1 text-xl font-bold ${s.color}`}>{s.count}</div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {workItems.map((w) => (
                          <div key={w.id} className="rounded-lg border border-border-color bg-card-bg p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-text-primary truncate">{w.title || w.work_type_name}</div>
                              <div className="text-xs text-text-secondary mt-0.5">
                                {w.assigned_to_name} &middot; Due: {w.due_date ? new Date(w.due_date).toLocaleDateString() : '\u2014'}
                              </div>
                            </div>
                            <select
                              value={w.status}
                              onChange={(e) => void handleWorkStatusChange(w.id, e.target.value as any)}
                              className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <Link href={`/workstation?work=${w.id}`} className="text-xs font-semibold text-accent hover:underline shrink-0">Open</Link>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {workError && <p className="text-xs text-red-500">{workError}</p>}
                </div>
              )}

              {/* ── Linked Datasheet Tabs ── */}
              {activeTab.startsWith('ds_') && (() => {
                const modelId = Number(activeTab.replace('ds_', ''));
                const ds = linkedDatasheets.find(d => d.model_id === modelId);
                const data = dsRecords[modelId];
                const loading = dsLoading === modelId;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-text-primary">
                        {ds?.display_name || 'Records'}
                      </h2>
                      <span className="text-xs text-text-secondary">
                        {data?.records.length ?? 0} records linked
                      </span>
                    </div>

                    {loading && (
                      <div className="flex items-center justify-center py-10">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-color border-t-accent" />
                      </div>
                    )}

                    {!loading && (!data || data.records.length === 0) && (
                      <div className="text-center py-10 text-sm text-text-secondary">
                        No records linked from {ds?.display_name || 'this datasheet'}.
                      </div>
                    )}

                    {!loading && data && data.records.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-border-color">
                        <table className="min-w-full divide-y divide-border-color text-sm">
                          <thead className="bg-bg-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
                              {data.fields
                                .filter(f => !['record_key', 'status', 'created_at', 'updated_at'].includes(f.name) && f.field_type !== 'auto_increment')
                                .slice(0, 6)
                                .map(f => (
                                  <th key={f.id} className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                                    {f.display_name}
                                  </th>
                                ))}
                              <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color bg-card-bg">
                            {data.records.map((rec, idx) => (
                              <tr key={rec.id} className="hover:bg-bg-secondary/50">
                                <td className="px-3 py-2 text-text-secondary">{idx + 1}</td>
                                {data.fields
                                  .filter(f => !['record_key', 'status', 'created_at', 'updated_at'].includes(f.name) && f.field_type !== 'auto_increment')
                                  .slice(0, 6)
                                  .map(f => (
                                    <td key={f.id} className="px-3 py-2 text-text-primary max-w-[200px] truncate">
                                      {rec.data[f.name] != null ? String(rec.data[f.name]) : '\u2014'}
                                    </td>
                                  ))}
                                <td className="px-3 py-2 text-text-secondary text-xs">
                                  {rec.created_at ? new Date(rec.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '\u2014'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ──────────────────────────────────────── */}
          <aside className={`border-l border-border-color bg-card-bg overflow-y-auto ${sidebarCollapsed ? 'hidden' : 'block'} lg:block`}>
            <div className="p-4 space-y-5">

              {/* Pipeline / Stage */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Stage</h3>
                {hasPipelineStages ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pipelineStages.sort((a, b) => a.sort_order - b.sort_order).map((stage) => {
                      const isActive = currentCustomer.pipelineStageId === stage.id;
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          disabled={saving}
                          onClick={() => !isActive && handlePipelineMove(stage.id)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                            isActive
                              ? 'text-white shadow-md scale-105'
                              : 'border border-border-color text-text-secondary hover:border-accent hover:text-text-primary'
                          }`}
                          style={isActive && stage.color ? { backgroundColor: stage.color } : undefined}
                        >
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">No pipeline stages configured.</p>
                )}
              </section>

              {/* Details */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Details</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Stage</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={currentCustomer.pipelineStageColor ? { backgroundColor: currentCustomer.pipelineStageColor + '22', color: currentCustomer.pipelineStageColor } : undefined}
                    >
                      {currentCustomer.pipelineStageName ?? 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Priority</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[currentCustomer.priority ?? 'medium'] ?? PRIORITY_DOT.medium}`} />
                      <span className="text-xs font-medium text-text-primary">{capitalize(currentCustomer.priority)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Assigned to</span>
                    {canAssignLeads ? (
                      <select
                        value={currentCustomer.assignedToId ?? ''}
                        onChange={(e) => handleAssignChange(e.target.value === '' ? null : Number(e.target.value))}
                        disabled={assigning}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-60 max-w-[140px]"
                      >
                        <option value="">Unassigned</option>
                        {employees.filter((emp) => emp.id === 0 || emp.is_active).map((emp) => (
                          <option key={emp.user_id} value={String(emp.user_id)}>
                            {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-text-primary">
                        {currentCustomer.assignedToId == null
                          ? 'Unassigned'
                          : currentCustomer.assignedToId === currentUserId
                            ? 'You'
                            : employees.find((e) => e.user_id === currentCustomer.assignedToId)?.name ?? '\u2014'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Source</span>
                    <span className="text-xs font-medium text-text-primary capitalize">{currentCustomer.source?.replace(/_/g, ' ') ?? '\u2014'}</span>
                  </div>

                  {/* AI Agent */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">AI Agent</span>
                    <select
                      value={currentCustomer.aiAgentId ?? ''}
                      onChange={(e) => handleSwitchAiAgent(e.target.value ? Number(e.target.value) : null)}
                      disabled={switchingAgent}
                      className="rounded-lg border border-border-color bg-bg-primary px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:border-accent disabled:opacity-60 max-w-[140px]"
                    >
                      <option value="">No agent</option>
                      {allAgents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lead Score */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">Lead Score</span>
                      <span className={`text-xs font-bold ${
                        (currentCustomer.leadScore ?? 0) >= 71 ? 'text-emerald-500' : (currentCustomer.leadScore ?? 0) >= 31 ? 'text-amber-500' : 'text-text-primary'
                      }`}>
                        {currentCustomer.leadScore != null ? Math.round(currentCustomer.leadScore) : '\u2014'}/100
                      </span>
                    </div>
                    {currentCustomer.leadScore != null && (
                      <div className="h-1.5 w-full rounded-full bg-bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            currentCustomer.leadScore >= 71 ? 'bg-emerald-500' : currentCustomer.leadScore >= 31 ? 'bg-amber-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, currentCustomer.leadScore))}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Created</span>
                    <span className="text-xs text-text-primary">{relativeTime(currentCustomer.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Last Activity</span>
                    <span className="text-xs text-text-primary">{relativeTime(currentCustomer.lastActivity)}</span>
                  </div>
                </div>
              </section>

              {/* Quick Note */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Quick Note</h3>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="mt-1.5 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {addingNote ? 'Adding\u2026' : 'Submit'}
                </button>
              </section>

              {/* Custom Fields */}
              {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setCustomFieldsExpanded((v) => !v)}
                    className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2"
                  >
                    <span>Custom Fields</span>
                    <svg className={`h-3.5 w-3.5 transition-transform ${customFieldsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {customFieldsExpanded && (
                    <div className="space-y-1.5">
                      <DynamicLeadFieldsInput value={currentCustomer.customFields} readonly />
                    </div>
                  )}
                </section>
              )}

              {/* Linked Channels */}
              {linkedChannels.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Channels</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedChannels.map((lc) => (
                      <span
                        key={`${lc.channel_id}-${lc.channel_identifier}`}
                        className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        title={lc.display_name || lc.channel_identifier}
                      >
                        {channelLabel(lc.channel_type)}{lc.display_name ? ` · ${lc.display_name}` : ''}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

        {/* ── ASSIGN WORK MODAL ────────────────────────────────────── */}
        <AssignWorkModal
          isOpen={assignWorkModalOpen}
          onClose={() => setAssignWorkModalOpen(false)}
          initialLeadId={Number.isFinite(Number(id)) ? Number(id) : null}
          onCreated={() => {
            setNotice('Work item created.');
            setError(null);
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
      </div>
    </ModuleGuard>
  );
}
