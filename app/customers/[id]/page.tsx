'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { ConversationList } from '@/components/customers/conversation-list';
import { LeadScoreDisplay } from '@/components/customers/lead-score-display';
import { CustomFieldsEditor } from '@/components/customers/custom-fields-editor';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/lib/auth-store';
import { useCustomerStore } from '@/lib/customer-store';
import type { LeadUpdate } from '@/services/customers';
import { listFollowups, type FollowUpMessage, sendFollowupNow, cancelFollowup, createFollowup, type FollowUpMessageCreate } from '@/services/followups';
import { listAgents, type Agent } from '@/services/agents';
import { getLeadTemplate } from '@/services/lead-templates';
import type { LeadTemplate } from '@/services/lead-templates';
import { listEmployees, type Employee } from '@/services/employees';

type TabId = 'overview' | 'details' | 'conversations' | 'notes' | 'followups';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'notes', label: 'Notes' },
];

function channelLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
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
  const business = useAuthStore((s) => (s.user as any)?.businesses?.[0]);
  const agentsEnabled = business?.agents_enabled !== false;
  const role = (business?.role as string) ?? 'owner';
  const canAssignLeads = role === 'owner' || role === 'manager';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<LeadUpdate>({});
  const [showCustomFieldsEditor, setShowCustomFieldsEditor] = useState(false);
  const [matchedTemplate, setMatchedTemplate] = useState<LeadTemplate | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [followups, setFollowups] = useState<FollowUpMessage[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupsError, setFollowupsError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState<{
    agent_id: number | '';
    message_text: string;
    scheduled_at: string;
    delivery_mode: 'auto' | 'manual';
  }>({
    agent_id: '',
    message_text: '',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16), // Default to tomorrow
    delivery_mode: 'auto', // Automatic = sent at scheduled time by worker; Manual = you must click Send now
  });

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => setEmployees([]));
    if (agentsEnabled) {
      listAgents().then(setAgents).catch(() => setAgents([]));
    }
  }, [agentsEnabled]);

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
      .catch((e: any) => {
        if (cancelled) return;
        setFollowupsError(e?.message ?? 'Failed to load follow-ups');
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
          status: currentCustomer.status,
          priority: currentCustomer.priority,
          source: currentCustomer.source,
          notes: currentCustomer.notes || undefined,
        });
      } else {
        setEditData({});
      }
    }
  }, [currentCustomer, isEditing]);

  useEffect(() => {
    const tid = currentCustomer?.templateId;
    if (!tid) {
      setMatchedTemplate(null);
      return;
    }
    let cancelled = false;
    getLeadTemplate(tid)
      .then((t) => {
        if (!cancelled) setMatchedTemplate(t);
      })
      .catch(() => {
        if (!cancelled) setMatchedTemplate(null);
      });
    return () => { cancelled = true; };
  }, [currentCustomer?.templateId]);

  const handleSave = async () => {
    if (!id || !currentCustomer) return;
    setIsSaving(true);
    try {
      const systemFields: Record<string, any> = {};
      if (currentCustomer.leadScore !== undefined) systemFields.lead_level_score = currentCustomer.leadScore;
      if (currentCustomer.lastScoreUpdate) systemFields.last_score_update = currentCustomer.lastScoreUpdate;
      if (currentCustomer.templateId != null) systemFields._template_id = currentCustomer.templateId;
      if (currentCustomer.lastFilled) systemFields.last_filled = currentCustomer.lastFilled;
      const extraData = { ...(currentCustomer.customFields || {}), ...systemFields };

      await updateLead(id, {
        ...editData,
        extra_data: Object.keys(extraData).length > 0 ? extraData : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update lead:', error);
      alert('Failed to update lead. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomFieldsUpdate = async (customFields: Record<string, any>) => {
    if (!id || !currentCustomer) return;
    setIsSaving(true);
    try {
      const systemFields: Record<string, any> = {};
      if (currentCustomer.leadScore !== undefined) {
        systemFields.lead_level_score = currentCustomer.leadScore;
      }
      if (currentCustomer.lastScoreUpdate) {
        systemFields.last_score_update = currentCustomer.lastScoreUpdate;
      }
      if (currentCustomer.templateId != null) {
        systemFields._template_id = currentCustomer.templateId;
      }
      if (currentCustomer.lastFilled) {
        systemFields.last_filled = currentCustomer.lastFilled;
      }
      const extraData = { ...customFields, ...systemFields };

      await updateLead(id, { extra_data: extraData });
      setShowCustomFieldsEditor(false);
    } catch (error) {
      console.error('Failed to update custom fields:', error);
      alert('Failed to update custom fields. Please try again.');
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
      alert('Failed to delete lead. Please try again.');
    }
  };

  const handleAssignChange = async (assignedToId: number | null) => {
    if (!id) return;
    setAssigning(true);
    try {
      await updateLead(id, { assigned_to_id: assignedToId });
      void fetchCustomerWithConversations(id);
    } catch (error) {
      console.error('Failed to update assignment:', error);
      alert('Failed to update assignment. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!id) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-base text-text-secondary">Invalid customer id.</p>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (!currentCustomer) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-base text-text-secondary">Loading customer…</p>
          </div>
        </ModuleGuard>
      </ProtectedShell>
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
    <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full space-y-3">
            {/* Header: name, status, priority, quick meta */}
            <div className="flex flex-col gap-3 rounded-xl border border-border-color bg-card-bg p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-text-primary">{displayName}</h1>
                  {currentCustomer.status && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                        currentCustomer.status === 'won'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                          : currentCustomer.status === 'qualified'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : currentCustomer.status === 'contacted'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : currentCustomer.status === 'lost'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                      }`}
                    >
                      {currentCustomer.status.charAt(0).toUpperCase() + currentCustomer.status.slice(1)}
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
                    onClick={() => router.push(`/conversations/${latestConvId}`)}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                >
                  Edit
                </button>
                <Link
                  href="/orders"
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                >
                  Create order
                </Link>
                <Link
                  href="/orders"
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                >
                  Book
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

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
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Summary</h2>
                      <div className="grid gap-2 text-base sm:grid-cols-2">
                        <div>
                          <span className="text-text-secondary">Source </span>
                          <span className="text-text-primary">{currentCustomer.source ? currentCustomer.source.replace('_', ' ') : '—'}</span>
                        </div>
                        {showAgentExperience && (
                          <>
                            <div>
                              <span className="text-text-secondary">Agent </span>
                              <span className="text-text-primary">
                                {currentCustomer.assignedAgent && currentCustomer.assignedAgent !== '—' ? currentCustomer.assignedAgent : 'Unassigned'}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-secondary">Conversations </span>
                              <span className="text-text-primary">{conversations.length}</span>
                            </div>
                          </>
                        )}
                        <div>
                          <span className="text-text-secondary">Assigned to </span>
                          {canAssignLeads ? (
                            <select
                              value={currentCustomer.assignedToId ?? ''}
                              onChange={(e) => handleAssignChange(e.target.value === '' ? null : Number(e.target.value))}
                              disabled={assigning}
                              className="rounded border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                            >
                              <option value="">Unassigned</option>
                              {employees.map((emp) => (
                                <option key={emp.user_id} value={String(emp.user_id)}>
                                  {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-text-primary">
                              {currentCustomer.assignedToId == null
                                ? 'Unassigned'
                                : currentCustomer.assignedToId === currentUserId
                                  ? 'You'
                                  : employees.find((e) => e.user_id === currentCustomer.assignedToId)?.name ?? employees.find((e) => e.user_id === currentCustomer.assignedToId)?.email ?? '—'}
                            </span>
                          )}
                        </div>
                      </div>
                    </section>
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Lead score</h2>
                      <LeadScoreDisplay score={currentCustomer.leadScore} lastUpdate={currentCustomer.lastScoreUpdate} showBreakdown={false} />
                    </section>
                    {currentCustomer.lastMessagePreview && currentCustomer.lastMessagePreview !== '—' && (
                      <section>
                        <h2 className="mb-2 text-sm font-semibold text-text-secondary">Last message</h2>
                        <p className="text-base text-text-primary">{currentCustomer.lastMessagePreview}</p>
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
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
                          <select
                            value={editData.status || 'new'}
                            onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
                          <select
                            value={editData.priority || 'medium'}
                            onChange={(e) => setEditData({ ...editData, priority: e.target.value as any })}
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
                        <div className="flex gap-2">
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
                            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <section>
                          <h2 className="mb-2 text-sm font-semibold text-text-secondary">Lead information</h2>
                          <dl className="space-y-1.5 text-base">
                            <div className="flex justify-between gap-2">
                              <dt className="text-text-secondary">Status</dt>
                              <dd className="text-text-primary">{currentCustomer.status ? currentCustomer.status.charAt(0).toUpperCase() + currentCustomer.status.slice(1) : 'New'}</dd>
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
                              onClick={() => setIsEditing(true)}
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
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-text-secondary">Custom fields</h2>
                            {!showCustomFieldsEditor && (
                              <button type="button" onClick={() => setShowCustomFieldsEditor(true)} className="text-sm font-semibold text-accent hover:underline">
                                Edit
                              </button>
                            )}
                          </div>
                          {showCustomFieldsEditor ? (
                            <CustomFieldsEditor
                              data={currentCustomer.customFields || {}}
                              onChange={handleCustomFieldsUpdate}
                              onCancel={() => setShowCustomFieldsEditor(false)}
                            />
                          ) : (
                            <div className="mt-2 space-y-1.5 text-base">
                              {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 ? (
                                Object.entries(currentCustomer.customFields).map(([key, value]) => (
                                  <div key={key} className="flex justify-between gap-2">
                                    <span className="text-text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className="text-text-primary">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-text-secondary">No custom fields</p>
                              )}
                            </div>
                          )}
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
                          onClick={() => router.push(`/conversations/${latestConvId}`)}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          Open latest
                        </button>
                      </div>
                    )}
                    {showAgentExperience ? (
                      <ConversationList
                        conversations={conversations}
                        onOpen={(convId) => router.push(`/conversations/${convId}`)}
                        onToggle={(convId, status) => toggleMode(convId, status)}
                      />
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
                      {agentsEnabled && agents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(!showCreateForm)}
                          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          {showCreateForm ? 'Cancel' : 'Create follow-up'}
                        </button>
                      )}
                    </div>

                    {/* Create follow-up form */}
                    {showCreateForm && agentsEnabled && agents.length > 0 && (
                      <div className="rounded-xl border border-border-color bg-card-bg p-4">
                        <h3 className="mb-3 text-sm font-semibold text-text-primary">Create manual follow-up</h3>
                        <div className="space-y-3">
                          {currentCustomer.channel && (
                            <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-secondary">
                              Channel: <span className="font-medium text-text-primary">{channelLabel(currentCustomer.channel)}</span>
                              {' '}(from lead&apos;s channel)
                            </div>
                          )}
                          <div>
                            <label htmlFor="create-agent" className="block text-sm font-medium text-text-secondary">
                              Agent <span className="text-red-500">*</span>
                            </label>
                            <select
                              id="create-agent"
                              value={createFormData.agent_id}
                              onChange={(e) =>
                                setCreateFormData({ ...createFormData, agent_id: e.target.value ? Number(e.target.value) : '' })
                              }
                              className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                            >
                              <option value="">Select an agent...</option>
                              {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name}
                                </option>
                              ))}
                            </select>
                          </div>
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
                                if (!id || !createFormData.agent_id || !createFormData.message_text.trim()) {
                                  alert('Please fill in all required fields');
                                  return;
                                }
                                setCreating(true);
                                setFollowupsError(null);
                                try {
                                  const payload: FollowUpMessageCreate = {
                                    agent_id: createFormData.agent_id as number,
                                    lead_id: Number(id),
                                    message_text: createFormData.message_text.trim(),
                                    scheduled_at: new Date(createFormData.scheduled_at).toISOString(),
                                    delivery_mode: createFormData.delivery_mode,
                                    channel_type: currentCustomer.channel || null,
                                  };
                                  await createFollowup(payload);
                                  setShowCreateForm(false);
                                  setCreateFormData({
                                    agent_id: '',
                                    message_text: '',
                                    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
                                    delivery_mode: 'auto',
                                  });
                                  // Reload follow-ups
                                  const leadId = Number(id);
                                  if (Number.isFinite(leadId)) {
                                    const items = await listFollowups({ lead_id: leadId });
                                    setFollowups(items);
                                  }
                                } catch (e: any) {
                                  setFollowupsError(e?.message ?? 'Failed to create follow-up');
                                } finally {
                                  setCreating(false);
                                }
                              }}
                              disabled={creating || !createFormData.agent_id || !createFormData.message_text.trim()}
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
                                            } catch (e) {
                                              alert('Failed to send follow-up. Please try again.');
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
                                            } catch (e) {
                                              alert('Failed to cancel follow-up. Please try again.');
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

                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Notes</h2>
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
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-text-secondary">Custom fields</h2>
                      {showCustomFieldsEditor ? (
                        <CustomFieldsEditor
                          data={currentCustomer.customFields || {}}
                          onChange={handleCustomFieldsUpdate}
                          onCancel={() => setShowCustomFieldsEditor(false)}
                        />
                      ) : (
                        <div className="space-y-1.5 text-base">
                          {currentCustomer.customFields && Object.keys(currentCustomer.customFields).length > 0 ? (
                            Object.entries(currentCustomer.customFields).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-2">
                                <span className="text-text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="text-text-primary">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-text-secondary">No custom fields. </p>
                          )}
                          <button type="button" onClick={() => setShowCustomFieldsEditor(true)} className="text-sm font-semibold text-accent hover:underline">
                            Edit custom fields
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
