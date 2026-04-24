'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConversationList } from '@/components/customers/conversation-list';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { DynamicLeadFieldsInput } from '@/components/customers/dynamic-lead-fields-input';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/lib/auth-store';
import { useCustomerStore } from '@/lib/customer-store';
import type { Customer, LeadUpdate } from '@/services/customers';
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
  setLeadAiAgent,
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
import { useAgentList, useEmployeeList } from '@/lib/hooks/use-reference-data';
import { listWork, updateWork, type Work } from '@/services/work';
import {
  relativeTime,
  capitalize,
  channelTypeLabel,
  buildTimeline,
  NOTE_CATEGORY_LABELS,
  NOTE_CATEGORY_COLORS,
  PRIORITY_DOT,
  BASE_TABS,
} from '@/lib/lead-utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeadSidebarPanelProps {
  leadId: string;
  initialData?: Customer;
  onClose: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadSidebarPanel({ leadId, initialData, onClose, onDeleted, onUpdated }: LeadSidebarPanelProps) {
  const router = useRouter();
  const id = leadId;

  const {
    currentCustomer: storeCustomer,
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

  // Use store customer if loaded for this lead, else fallback to initialData
  const currentCustomer = storeCustomer?.id === id ? storeCustomer : initialData ?? null;

  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const currentUserId = user?.id;
  const business = useAuthStore(
    (s) => (s.user as { businesses?: Array<{ role?: string; agents_enabled?: boolean }> } | null)?.businesses?.[0],
  );
  const agentsEnabled = business?.agents_enabled !== false;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAssignLeads = hasPermission('manage_leads');

  // --- State ---
  type TabId = string;
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<LeadUpdate>({});
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({});

  // More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Sidebar details
  const [pipelineStages, setPipelineStages] = useState<LeadPipelineStage[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [switchingAgent, setSwitchingAgent] = useState(false);
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

  // Nurture enrollment
  const [nurtureEnrollment, setNurtureEnrollment] = useState<import('@/services/nurture').NurtureEnrollment | null | undefined>(undefined);
  const [nurtureActing, setNurtureActing] = useState(false);

  useEffect(() => {
    if (!id) return;
    import('@/services/nurture').then(({ getLeadEnrollment }) =>
      getLeadEnrollment(Number(id)).then(setNurtureEnrollment).catch(() => setNurtureEnrollment(null))
    );
  }, [id]);

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

  // Reset on lead change
  useEffect(() => {
    loadedTabsRef.current = new Set();
    setActiveTab('timeline');
    setError(null);
    setNotice(null);
    setShowMoreMenu(false);
    setIsEditing(false);
  }, [id]);

  // Fetch full lead data
  useEffect(() => {
    if (!id) return;
    void fetchCustomerWithConversations(id);
  }, [id, fetchCustomerWithConversations]);

  // Pipeline stages + agents
  useEffect(() => {
    listPipelineStages().then(setPipelineStages).catch(() => setPipelineStages([]));
    listAgents().then(setAllAgents).catch(() => setAllAgents([]));
  }, []);

  // Linked datasheets
  useEffect(() => {
    if (!id) return;
    getLinkedDatasheets(id).then(setLinkedDatasheets).catch(() => setLinkedDatasheets([]));
  }, [id]);

  // Timeline data
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

  // Follow-ups
  useEffect(() => {
    if (!id) return;
    const leadIdNum = Number(id);
    if (!Number.isFinite(leadIdNum)) return;
    let cancelled = false;
    setFollowupsLoading(true);
    listFollowups({ lead_id: leadIdNum })
      .then((items) => { if (!cancelled) setFollowups(items); })
      .catch((e: unknown) => { if (!cancelled) setFollowupsError(e instanceof Error ? e.message : 'Failed to load follow-ups'); })
      .finally(() => { if (!cancelled) setFollowupsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Latest conversation sessions
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
    const leadIdNum = Number(id);
    if (!Number.isFinite(leadIdNum)) return;
    let cancelled = false;
    setWorkLoading(true);
    setWorkError(null);
    listWork({ page: 1, per_page: 50, lead_id: leadIdNum })
      .then((res) => { if (!cancelled) { setWorkItems(res.items ?? []); loadedTabsRef.current.add('work'); } })
      .catch((e: unknown) => { if (!cancelled) { setWorkItems([]); setWorkError(e instanceof Error ? e.message : 'Failed to load work items'); } })
      .finally(() => { if (!cancelled) setWorkLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, id]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
      const cleanedEditData = Object.fromEntries(
        Object.entries(editData).filter(([, v]) => v !== '' && v != null)
      );
      await updateLead(id, { ...cleanedEditData, extra_data: Object.keys(extraData).length > 0 ? extraData : undefined });
      setIsEditing(false);
      setNotice('Lead updated.');
      onUpdated?.();
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
      onDeleted?.();
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
      onUpdated?.();
    } catch {
      setError('Failed to move pipeline stage.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignChange = async (assignedToId: number | null) => {
    if (!id) return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      const { assignLead } = await import('@/services/customers');
      await assignLead(id, assignedToId);
      void fetchCustomerWithConversations(id);
      setNotice('Assignee updated.');
      onUpdated?.();
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
      const leadIdNum = Number(id);
      if (Number.isFinite(leadIdNum)) { const items = await listFollowups({ lead_id: leadIdNum }); setFollowups(items); }
      setNotice('Follow-up created.');
    } catch (e: unknown) {
      setFollowupsError(e instanceof Error ? e.message : 'Failed to create follow-up');
    } finally {
      setCreating(false);
    }
  };

  // --- Derived ---

  const allTabs = [...BASE_TABS, ...linkedDatasheets.map(ds => ({
    id: `ds_${ds.model_id}`,
    label: ds.display_name,
    count: ds.record_count,
  }))];

  const latestConvId = conversations.length
    ? [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0].id
    : null;
  const hasConversation = conversations.length > 0;
  const showAgentExperience = agentsEnabled && hasConversation;
  const phone = currentCustomer?.phone?.trim();
  const email = currentCustomer?.email?.trim();
  const displayName = currentCustomer?.name || phone || 'Unknown';
  const timeline = buildTimeline(activities, notes);
  const hasPipelineStages = pipelineStages.length > 0;

  // --- Render ---

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-bg-primary shadow-2xl animate-in slide-in-from-right duration-200">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border-color bg-card-bg shrink-0">
          {/* Avatar circle */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent text-sm font-bold shrink-0">
            {(currentCustomer?.name ?? '?').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-text-primary truncate">{displayName}</h2>
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              {phone && <span>{phone}</span>}
              {email && <span className="truncate">{email}</span>}
              {!phone && !email && <span>No contact info</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="rounded-lg border border-border-color bg-bg-primary p-2 text-text-secondary hover:border-accent hover:text-accent transition-colors"
                title="Call"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </a>
            )}
            {latestConvId && (
              <button
                type="button"
                onClick={() => router.push(`/conversations/${latestConvId}`)}
                className="rounded-lg border border-border-color bg-bg-primary p-2 text-text-secondary hover:border-accent hover:text-accent transition-colors"
                title="Message"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </button>
            )}

            {/* More menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((v) => !v)}
                className="rounded-lg border border-border-color bg-bg-primary p-2 text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
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
                        if (currentCustomer) {
                          setEditData({
                            name: currentCustomer.name || '',
                            company: currentCustomer.company || '',
                            phone: currentCustomer.phone || '',
                            email: currentCustomer.email || '',
                            priority: currentCustomer.priority as LeadUpdate['priority'],
                            source: currentCustomer.source || '',
                            expected_value: currentCustomer.expectedValue ?? undefined,
                            expected_close_date: currentCustomer.expectedCloseDate ?? undefined,
                          });
                          setEditCustomFields(currentCustomer.customFields || {});
                        }
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

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-bg-secondary transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Notices */}
        {error && (
          <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 shrink-0">
            {error}
            <button type="button" onClick={() => setError(null)} className="ml-2 font-semibold hover:underline">Dismiss</button>
          </div>
        )}
        {notice && !error && (
          <div className="mx-4 mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="ml-2 font-semibold hover:underline">Dismiss</button>
          </div>
        )}

        {/* ── BODY (scrollable) ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading state */}
          {!currentCustomer && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}

          {currentCustomer && (
            <>
              {/* ── PIPELINE STAGE SELECTOR ──────────────────────── */}
              {hasPipelineStages && (
                <div className="px-5 py-3 border-b border-border-color bg-bg-secondary/30">
                  <div className="flex flex-wrap gap-1.5">
                    {pipelineStages.sort((a, b) => a.sort_order - b.sort_order).map((stage, i) => {
                      const isActive = currentCustomer.pipelineStageId === stage.id;
                      // Use stage.color but fall back to a palette so gray stages still look distinct
                      const PALETTE = ['#3B82F6','#F59E0B','#8B5CF6','#10B981','#EF4444','#06B6D4','#F97316'];
                      const activeColor = (stage.color && stage.color !== '#6B7280') ? stage.color : PALETTE[i % PALETTE.length];
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          disabled={saving}
                          onClick={() => !isActive && handlePipelineMove(stage.id)}
                          title={isActive ? `Current stage: ${stage.name}` : `Move to ${stage.name}`}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                            isActive
                              ? 'text-white shadow-sm ring-2 ring-offset-1 ring-offset-bg-secondary'
                              : 'border border-border-color text-text-secondary hover:border-accent hover:text-text-primary bg-transparent'
                          } disabled:opacity-60`}
                          style={isActive ? { backgroundColor: activeColor, ringColor: activeColor } : undefined}
                        >
                          {isActive && <span className="mr-1 opacity-80">✓</span>}{stage.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── DETAILS CARD ─────────────────────────────────── */}
              <div className="px-5 py-4 border-b border-border-color">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {/* Priority */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Priority</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[currentCustomer.priority ?? 'medium'] ?? PRIORITY_DOT.medium}`} />
                      <span className="text-xs font-medium text-text-primary">{capitalize(currentCustomer.priority)}</span>
                    </div>
                  </div>

                  {/* Source */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Source</span>
                    <span className="text-xs font-medium text-text-primary capitalize">{currentCustomer.source?.replace(/_/g, ' ') ?? '\u2014'}</span>
                  </div>

                  {/* Assigned to */}
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
                  <div className="col-span-2">
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

                  {/* Dates */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Created</span>
                    <span className="text-xs text-text-primary">{relativeTime(currentCustomer.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Last Activity</span>
                    <span className="text-xs text-text-primary">{relativeTime(currentCustomer.lastActivity)}</span>
                  </div>
                </div>

                {/* Channels */}
                {linkedChannels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-color">
                    {linkedChannels.map((lc) => (
                      <span
                        key={`${lc.channel_id}-${lc.channel_identifier}`}
                        className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        title={lc.display_name || lc.channel_identifier}
                      >
                        {channelTypeLabel(lc.channel_type)}{lc.display_name ? ` \u00b7 ${lc.display_name}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Custom Fields */}
                {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-color">
                    <button
                      type="button"
                      onClick={() => setCustomFieldsExpanded((v) => !v)}
                      className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-text-secondary"
                    >
                      <span>Custom Fields</span>
                      <svg className={`h-3.5 w-3.5 transition-transform ${customFieldsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {customFieldsExpanded && (
                      <div className="mt-2 space-y-1.5">
                        <DynamicLeadFieldsInput value={currentCustomer.customFields} readonly />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── TABS ──────────────────────────────────────────── */}
              <div className="flex border-b border-border-color bg-card-bg sticky top-0 z-10 overflow-x-auto shrink-0">
                {allTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
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
                    className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-b-2 border-accent text-accent'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                    {'count' in tab && typeof (tab as { count?: number }).count === 'number' && (
                      <span className="ml-1 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px]">
                        {(tab as { count: number }).count}
                      </span>
                    )}
                    {tab.id === 'followups' && followups.length > 0 && (
                      <span className="ml-1 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px]">{followups.length}</span>
                    )}
                    {tab.id === 'work' && workItems.length > 0 && (
                      <span className="ml-1 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px]">{workItems.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── TAB CONTENT ────────────────────────────────────── */}
              <div className="p-4">

                {/* TIMELINE */}
                {activeTab === 'timeline' && (
                  <div className="space-y-3">
                    {/* Active Nurture Sequence card */}
                    {nurtureEnrollment && (nurtureEnrollment.status === 'active' || nurtureEnrollment.status === 'paused') && (
                      <div className={`rounded-xl border p-3 ${nurtureEnrollment.status === 'paused' ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20' : 'border-accent/30 bg-accent/5'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <svg className={`h-3.5 w-3.5 ${nurtureEnrollment.status === 'paused' ? 'text-orange-500' : 'text-accent'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="text-xs font-semibold text-text-primary">Nurture Sequence</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${nurtureEnrollment.status === 'paused' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                              {nurtureEnrollment.status}
                            </span>
                          </div>
                          <a href={`/nurture/${nurtureEnrollment.sequence_id}`} className="text-[10px] text-accent hover:underline">View →</a>
                        </div>
                        <div className="text-sm font-medium text-text-primary truncate">{nurtureEnrollment.sequence_name}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          Step {nurtureEnrollment.current_step} of {nurtureEnrollment.total_steps}
                          {nurtureEnrollment.next_send_at && nurtureEnrollment.status === 'active' && (
                            <> · Next: {new Date(nurtureEnrollment.next_send_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                          )}
                          {nurtureEnrollment.status === 'paused' && nurtureEnrollment.paused_reason === 'lead_replied' && ' · Lead replied'}
                        </div>
                        <div className="flex gap-2 mt-2.5">
                          {nurtureEnrollment.status === 'active' && (
                            <button disabled={nurtureActing} onClick={async () => {
                              setNurtureActing(true);
                              try {
                                const { pauseEnrollment } = await import('@/services/nurture');
                                await pauseEnrollment(nurtureEnrollment.id);
                                setNurtureEnrollment(e => e ? { ...e, status: 'paused' as const, next_send_at: null } : e);
                              } finally { setNurtureActing(false); }
                            }} className="rounded-lg px-2.5 py-1 text-xs border border-border-color text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50">
                              Pause
                            </button>
                          )}
                          {nurtureEnrollment.status === 'paused' && (
                            <button disabled={nurtureActing} onClick={async () => {
                              setNurtureActing(true);
                              try {
                                const { resumeEnrollment } = await import('@/services/nurture');
                                const updated = await resumeEnrollment(nurtureEnrollment.id);
                                setNurtureEnrollment(updated);
                              } finally { setNurtureActing(false); }
                            }} className="rounded-lg px-2.5 py-1 text-xs border border-accent/40 text-accent hover:bg-accent/5 transition-colors disabled:opacity-50">
                              Resume
                            </button>
                          )}
                          <button disabled={nurtureActing} onClick={async () => {
                            if (!confirm('Cancel this nurture sequence?')) return;
                            setNurtureActing(true);
                            try {
                              const { cancelEnrollment } = await import('@/services/nurture');
                              await cancelEnrollment(nurtureEnrollment.id);
                              setNurtureEnrollment(null);
                            } finally { setNurtureActing(false); }
                          }} className="rounded-lg px-2.5 py-1 text-xs border border-border-color text-text-secondary hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Add note */}
                    <div className="rounded-lg border border-border-color bg-card-bg p-3">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about this lead..."
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                      />
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
                      <div className="text-center py-8 text-sm text-text-secondary">No activity yet.</div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border-color" />
                        <div className="space-y-3">
                          {timeline.map((entry) => (
                            <div key={entry.id} className="relative flex gap-3 pl-0">
                              <div className={`relative z-10 mt-1 h-7 w-7 shrink-0 rounded-full ${entry.iconColor} flex items-center justify-center text-white text-xs font-bold`}>
                                {entry.type === 'note' ? '\u270E' : '\u2022'}
                              </div>
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
                                  <p className="mt-0.5 text-sm text-text-secondary whitespace-pre-wrap break-words line-clamp-3">{entry.description}</p>
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

                {/* CONVERSATIONS */}
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
                          <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-sm text-text-secondary">Loading session insights\u2026</div>
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
                              {(showAllSessions ? latestSessions : latestSessions.slice(0, 3)).map((session) => {
                                const hasCost = session.llmCostUsd > 0 || session.llmRunsCount > 0;
                                const costStr = session.llmCostUsd < 0.01
                                  ? `$${session.llmCostUsd.toFixed(6)}`
                                  : `$${session.llmCostUsd.toFixed(4)}`;
                                const totalTok = (session.llmInputTokens || 0) + (session.llmOutputTokens || 0);
                                return (
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
                                    {hasCost && (
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
                                        <span className="font-medium text-text-primary">LLM cost: {costStr}</span>
                                        <span>&middot; {session.llmRunsCount} run{session.llmRunsCount === 1 ? '' : 's'}</span>
                                        {totalTok > 0 && (
                                          <span>&middot; {totalTok.toLocaleString()} tok</span>
                                        )}
                                        {session.llmCachedInputTokens > 0 && (
                                          <span className="text-emerald-600">&middot; {session.llmCachedInputTokens.toLocaleString()} cached</span>
                                        )}
                                      </div>
                                    )}
                                    {session.summary && <div className="mt-0.5 text-xs line-clamp-1">{session.summary}</div>}
                                  </div>
                                );
                              })}
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
                        {!conversations.length && <p>No conversations yet.</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* FOLLOW-UPS */}
                {activeTab === 'followups' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-text-secondary">Follow-ups</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateForm(!showCreateForm);
                          if (!showCreateForm && linkedChannels.length === 1) {
                            setCreateFormData((prev) => ({ ...prev, channel_id: linkedChannels[0].channel_id }));
                          }
                        }}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        {showCreateForm ? 'Cancel' : '+ New'}
                      </button>
                    </div>

                    {showCreateForm && (
                      <div className="rounded-lg border border-border-color bg-card-bg p-3 space-y-2.5">
                        {linkedChannels.length > 0 ? (
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Channel *</label>
                            <select
                              value={createFormData.channel_id || ''}
                              onChange={(e) => setCreateFormData({ ...createFormData, channel_id: e.target.value ? Number(e.target.value) : '' })}
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                            >
                              <option value="">Select channel...</option>
                              {linkedChannels.map((lc) => (
                                <option key={lc.channel_id} value={lc.channel_id}>{channelTypeLabel(lc.channel_type)}</option>
                              ))}
                            </select>
                          </div>
                        ) : currentCustomer?.channel ? (
                          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary">
                            Channel: <span className="font-medium text-text-primary">{channelTypeLabel(currentCustomer.channel)}</span>
                          </div>
                        ) : null}
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Message *</label>
                          <textarea
                            value={createFormData.message_text}
                            onChange={(e) => setCreateFormData({ ...createFormData, message_text: e.target.value })}
                            rows={3}
                            maxLength={4000}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                            placeholder="Enter the follow-up message..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Scheduled *</label>
                            <input
                              type="datetime-local"
                              value={createFormData.scheduled_at}
                              onChange={(e) => setCreateFormData({ ...createFormData, scheduled_at: e.target.value })}
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Delivery</label>
                            <div className="flex gap-1.5 mt-1">
                              {(['auto', 'manual'] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setCreateFormData({ ...createFormData, delivery_mode: mode })}
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    createFormData.delivery_mode === mode
                                      ? 'bg-accent text-white'
                                      : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent'
                                  }`}
                                >
                                  {mode === 'auto' ? 'Auto' : 'Manual'}
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
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {creating ? 'Creating\u2026' : 'Create'}
                          </button>
                          <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent">
                            Cancel
                          </button>
                        </div>
                        {followupsError && <p className="text-xs text-red-500">{followupsError}</p>}
                      </div>
                    )}

                    {followupsLoading ? (
                      <p className="text-xs text-text-secondary">Loading follow-ups\u2026</p>
                    ) : followups.length === 0 ? (
                      <div className="text-center py-6 text-sm text-text-secondary">No follow-ups yet.</div>
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
                                      {f.channel_type ? channelTypeLabel(f.channel_type) : 'Default'} &middot; {f.delivery_mode === 'auto' ? 'Auto' : 'Manual'}
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

                {/* WORK */}
                {activeTab === 'work' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-text-secondary">Work Items</h3>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAssignWorkModalOpen(true)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">+ Task</button>
                        <Link href="/work" className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent">Board</Link>
                      </div>
                    </div>
                    {workLoading ? (
                      <p className="text-xs text-text-secondary">Loading\u2026</p>
                    ) : workItems.length === 0 ? (
                      <div className="text-center py-6 text-sm text-text-secondary">No work items linked.</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Open', count: workItems.filter((w) => w.status === 'pending' || w.status === 'in_progress').length, color: 'text-blue-600 dark:text-blue-400' },
                            { label: 'Done', count: workItems.filter((w) => w.status === 'completed').length, color: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Overdue', count: workItems.filter((w) => w.due_date && new Date(w.due_date).getTime() < Date.now() && w.status !== 'completed' && w.status !== 'cancelled').length, color: 'text-red-600 dark:text-red-400' },
                          ].map((s) => (
                            <div key={s.label} className="rounded-lg border border-border-color bg-card-bg p-2 text-center">
                              <div className="text-[10px] uppercase tracking-wide text-text-secondary">{s.label}</div>
                              <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
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

                {/* LINKED DATASHEETS */}
                {activeTab.startsWith('ds_') && (() => {
                  const modelId = Number(activeTab.replace('ds_', ''));
                  const ds = linkedDatasheets.find(d => d.model_id === modelId);
                  const data = dsRecords[modelId];
                  const loading = dsLoading === modelId;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-primary">{ds?.display_name || 'Records'}</h3>
                        <span className="text-xs text-text-secondary">{data?.records.length ?? 0} records</span>
                      </div>
                      {loading && (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-color border-t-accent" />
                        </div>
                      )}
                      {!loading && (!data || data.records.length === 0) && (
                        <div className="text-center py-8 text-sm text-text-secondary">No records linked.</div>
                      )}
                      {!loading && data && data.records.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-border-color">
                          <table className="min-w-full divide-y divide-border-color text-sm">
                            <thead className="bg-bg-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
                                {data.fields
                                  .filter(f => !['record_key', 'status', 'created_at', 'updated_at'].includes(f.name) && f.field_type !== 'auto_increment')
                                  .slice(0, 5)
                                  .map(f => (
                                    <th key={f.id} className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">{f.display_name}</th>
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
                                    .slice(0, 5)
                                    .map(f => (
                                      <td key={f.id} className="px-3 py-2 text-text-primary max-w-[160px] truncate">
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
            </>
          )}
        </div>

        {/* ── EDIT MODAL ──────────────────────────────────────────── */}
        {isEditing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg mx-4 rounded-xl border border-border-color bg-card-bg shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
                <h2 className="text-base font-semibold text-text-primary">Edit Lead</h2>
                <button type="button" onClick={() => setIsEditing(false)} className="text-text-secondary hover:text-text-primary text-lg">&times;</button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Name', key: 'name', type: 'text' },
                  { label: 'Company', key: 'company', type: 'text' },
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
                    <label className="block text-sm font-medium text-text-secondary mb-1">Expected Value (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editData.expected_value ?? ''}
                      onChange={(e) => setEditData({ ...editData, expected_value: e.target.value ? Number(e.target.value) : null })}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Close Date</label>
                    <input
                      type="date"
                      value={editData.expected_close_date ?? ''}
                      onChange={(e) => setEditData({ ...editData, expected_close_date: e.target.value || null })}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Priority</label>
                    <select value={editData.priority || 'medium'} onChange={(e) => setEditData({ ...editData, priority: e.target.value as LeadUpdate['priority'] })} className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
                      {['low', 'medium', 'high'].map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Source</label>
                    <select value={editData.source || ''} onChange={(e) => setEditData({ ...editData, source: e.target.value })} className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none">
                      {['whatsapp', 'website', 'referral', 'walk-in', 'ad_campaign', 'other'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                    </select>
                  </div>
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

        {/* ── ASSIGN WORK MODAL ───────────────────────────────────── */}
        <AssignWorkModal
          isOpen={assignWorkModalOpen}
          onClose={() => setAssignWorkModalOpen(false)}
          initialLeadId={Number.isFinite(Number(id)) ? Number(id) : null}
          onCreated={() => {
            setNotice('Work item created.');
            setError(null);
            if (activeTab === 'work' && id) {
              const leadIdNum = Number(id);
              if (Number.isFinite(leadIdNum)) {
                listWork({ page: 1, per_page: 50, lead_id: leadIdNum })
                  .then((res) => setWorkItems(res.items ?? []))
                  .catch(() => setWorkItems([]));
              }
            }
          }}
        />
      </div>
    </>
  );
}
