'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2, Clock,
  Users, MessageSquare, Rocket, Loader2, AlertCircle, Coins,
  Search, X,
} from 'lucide-react';
import {
  createCampaign, createSequence, addStep, updateSequence,
  previewAudience, getCreditsInfo, getBackfillCount, backfillExistingMembers,
  listSegments,
  type AudienceFilter, type CreateCampaignPayload, type CreditsInfo, type Segment,
} from '@/services/campaigns';
import { apiFetch } from '@/lib/api-client';

// ── Types for contact/group search ──────────────────────────────────────────

interface ContactResult {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
}
interface ContactListResponse {
  contacts: ContactResult[];
  total: number;
  page: number;
  per_page: number;
}
interface GroupResult {
  id: number;
  name: string;
  color: string | null;
  member_count: number;
}


interface WizardStep {
  templateId: number | null;
  templateName: string;
  templateBody: string;
  delayDays: number;
  delayHours: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  skipWeekends: boolean;
}

type AudienceMode = 'contacts' | 'groups' | 'file' | 'ai' | 'segment' | 'phones';

interface TemplateOption {
  id: number;
  name: string;
  meta_template_name: string;
  body: string;
  language: string;
  meta_status: string;
  category: string;
}

interface ChannelOption {
  id: number;
  name: string;
  type: string;
  is_connected: boolean;
}

export default function CampaignWizard() {
  const router = useRouter();

  const [wizardStep, setWizardStep] = useState(1); // 1=Audience, 2=Message, 3=Review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Audience state
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('contacts');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<ContactResult[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<GroupResult[]>([]);
  const [phones, setPhones] = useState('');
  const [segmentId, setSegmentId] = useState<number | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Groups list
  const [allGroups, setAllGroups] = useState<GroupResult[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Segments list
  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // Message steps
  const [steps, setSteps] = useState<WizardStep[]>([{
    templateId: null,
    templateName: '',
    templateBody: '',
    delayDays: 0,
    delayHours: 0,
    sendWindowStart: '09:00',
    sendWindowEnd: '18:00',
    skipWeekends: true,
  }]);
  const [editingStep, setEditingStep] = useState<number | null>(0);

  // Campaign settings
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('marketing');
  const [channelId, setChannelId] = useState<number | null>(null);
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [onReply, setOnReply] = useState<'pause' | 'stop' | 'continue'>('pause');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Auto-enroll state
  const [autoEnrollEnabled, setAutoEnrollEnabled] = useState(false);
  const [autoEnrollMaxPerDay, setAutoEnrollMaxPerDay] = useState(50);
  const [autoEnrollMonthlyCap, setAutoEnrollMonthlyCap] = useState<number | null>(null);

  // Backfill modal
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillCount, setBackfillCount] = useState(0);
  const [pendingSequenceId, setPendingSequenceId] = useState<number | null>(null);

  // Data
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);

  const isSequence = steps.length > 1;

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    try {
      const [tmplRes, chRes, credRes] = await Promise.allSettled([
        apiFetch<TemplateOption[]>('/message-templates?channel=whatsapp&status=approved'),
        apiFetch<ChannelOption[]>('/channels'),
        getCreditsInfo(),
      ]);
      if (tmplRes.status === 'fulfilled') setTemplates(tmplRes.value);
      if (chRes.status === 'fulfilled') {
        const wa = chRes.value.filter((c) => c.type === 'whatsapp' && c.is_connected);
        setChannels(wa);
        if (wa.length === 1) setChannelId(wa[0].id);
      }
      if (credRes.status === 'fulfilled') setCredits(credRes.value);
    } catch {}
  }

  // ── Contact search with debounce ──────────────────────────────────────────
  const searchContacts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setContactResults([]);
      return;
    }
    setContactSearchLoading(true);
    try {
      const res = await apiFetch<ContactListResponse>(
        `/contacts-v2?search=${encodeURIComponent(query)}&per_page=20&page=1`
      );
      setContactResults(res.contacts || []);
    } catch {
      setContactResults([]);
    } finally {
      setContactSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!contactSearch.trim()) {
      setContactResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => searchContacts(contactSearch), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [contactSearch, searchContacts]);

  function toggleContact(c: ContactResult) {
    if (selectedContactIds.includes(c.id)) {
      setSelectedContactIds((prev) => prev.filter((id) => id !== c.id));
      setSelectedContacts((prev) => prev.filter((x) => x.id !== c.id));
    } else {
      setSelectedContactIds((prev) => [...prev, c.id]);
      setSelectedContacts((prev) => [...prev, c]);
    }
  }

  function removeContact(id: number) {
    setSelectedContactIds((prev) => prev.filter((x) => x !== id));
    setSelectedContacts((prev) => prev.filter((x) => x.id !== id));
  }

  // ── Load groups ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (audienceMode === 'groups' && allGroups.length === 0) {
      setGroupsLoading(true);
      apiFetch<GroupResult[]>('/contact-groups')
        .then((g) => setAllGroups(g))
        .catch(() => {})
        .finally(() => setGroupsLoading(false));
    }
  }, [audienceMode, allGroups.length]);

  function toggleGroup(g: GroupResult) {
    if (selectedGroupIds.includes(g.id)) {
      setSelectedGroupIds((prev) => prev.filter((id) => id !== g.id));
      setSelectedGroups((prev) => prev.filter((x) => x.id !== g.id));
    } else {
      setSelectedGroupIds((prev) => [...prev, g.id]);
      setSelectedGroups((prev) => [...prev, g]);
    }
  }

  // ── Load segments ───────────────────────────────────────────────────────
  useEffect(() => {
    if (audienceMode === 'segment' && allSegments.length === 0) {
      setSegmentsLoading(true);
      listSegments()
        .then((s) => setAllSegments(s))
        .catch(() => {})
        .finally(() => setSegmentsLoading(false));
    }
  }, [audienceMode, allSegments.length]);

  // ── Compute audience count ──────────────────────────────────────────────
  useEffect(() => {
    if (audienceMode === 'contacts') {
      setAudienceCount(selectedContactIds.length);
    } else if (audienceMode === 'groups') {
      const total = selectedGroups.reduce((sum, g) => sum + (g.member_count || 0), 0);
      setAudienceCount(total);
    } else if (audienceMode === 'phones') {
      const count = phones.split(/[\n,]+/).filter((p) => p.trim()).length;
      setAudienceCount(count || null);
    } else if (audienceMode === 'segment') {
      const seg = allSegments.find((s) => s.id === segmentId);
      setAudienceCount(seg?.cached_count ?? null);
    } else {
      setAudienceCount(null);
    }
  }, [audienceMode, selectedContactIds, selectedGroups, phones, segmentId, allSegments]);

  function updateStep(index: number, partial: Partial<WizardStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...partial } : s)));
  }

  function addNewStep() {
    setSteps((prev) => [
      ...prev,
      {
        templateId: null,
        templateName: '',
        templateBody: '',
        delayDays: 1,
        delayHours: 0,
        sendWindowStart: '09:00',
        sendWindowEnd: '18:00',
        skipWeekends: true,
      },
    ]);
    setEditingStep(steps.length);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setEditingStep(null);
  }

  function getAudienceConfig(): Record<string, unknown> {
    if (audienceMode === 'contacts') return { contact_ids: selectedContactIds };
    if (audienceMode === 'groups') return { contact_ids: selectedContactIds, group_ids: selectedGroupIds };
    if (audienceMode === 'phones') return { phones: phones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean) };
    if (audienceMode === 'segment' && segmentId) return { segment_id: segmentId };
    if (audienceMode === 'ai' && audienceFilter) return audienceFilter as unknown as Record<string, unknown>;
    return {};
  }

  function getAudienceType(): string {
    if (audienceMode === 'segment') return 'segment';
    if (audienceMode === 'ai') return 'ai_filter';
    return 'manual';
  }

  const totalCredits = (audienceCount || 0) * steps.length;

  async function handleLaunch() {
    setLoading(true);
    setError('');
    try {
      if (isSequence) {
        // Create a nurture sequence
        const autoEnrollSource = autoEnrollEnabled
          ? audienceMode === 'groups' && selectedGroupIds.length > 0
            ? { auto_enroll_source_type: 'group' as const, auto_enroll_source_id: selectedGroupIds[0] }
            : audienceMode === 'segment' && segmentId
            ? { auto_enroll_source_type: 'segment' as const, auto_enroll_source_id: segmentId }
            : {}
          : {};
        const seq = await createSequence({
          name: name || 'New sequence',
          on_reply: onReply,
          timezone,
          ...(autoEnrollEnabled ? {
            auto_enroll_enabled: true,
            auto_enroll_max_per_day: autoEnrollMaxPerDay,
            auto_enroll_monthly_cap: autoEnrollMonthlyCap,
            ...autoEnrollSource,
          } : {}),
        });
        // Add steps
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          if (!s.templateId) continue;
          await addStep(seq.id, {
            step_number: i + 1,
            delay_days: i === 0 ? 0 : s.delayDays,
            delay_hours: i === 0 ? 0 : s.delayHours,
            template_id: s.templateId,
            send_window_start: s.sendWindowStart,
            send_window_end: s.sendWindowEnd,
            skip_weekends: s.skipWeekends,
          });
        }
        // Activate — check for backfill first
        await updateSequence(seq.id, { status: 'active' });
        if (autoEnrollEnabled) {
          try {
            const { existing_member_count } = await getBackfillCount(seq.id);
            if (existing_member_count > 0) {
              setPendingSequenceId(seq.id);
              setBackfillCount(existing_member_count);
              setShowBackfillModal(true);
              setLoading(false);
              return;
            }
          } catch {}
        }
        router.push(`/campaigns/seq-${seq.id}`);
      } else {
        // Create a blast campaign
        const step = steps[0];
        if (!step.templateId || !channelId) {
          setError('Please select a template and channel');
          setLoading(false);
          return;
        }
        const payload: CreateCampaignPayload = {
          name: name || 'New campaign',
          category: category as CreateCampaignPayload['category'],
          template_id: step.templateId,
          channel_id: channelId,
          audience_type: getAudienceType() as CreateCampaignPayload['audience_type'],
          audience_config: getAudienceConfig(),
          schedule_type: scheduleType,
          scheduled_at: scheduleType === 'scheduled' ? scheduledAt : undefined,
        };
        const campaign = await createCampaign(payload);
        router.push(`/campaigns/${campaign.id}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back link */}
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All campaigns
      </button>

      <h1 className="text-xl font-bold mb-6">New campaign</h1>

      {/* Stepper */}
      <div className="flex items-center gap-4 mb-8">
        {[
          { n: 1, label: 'Audience', icon: Users },
          { n: 2, label: 'Message', icon: MessageSquare },
          { n: 3, label: 'Review', icon: Rocket },
        ].map(({ n, label, icon: Icon }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              wizardStep > n
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : wizardStep === n
                ? 'bg-accent text-white'
                : 'bg-surface-secondary text-text-secondary'
            }`}>
              {wizardStep > n ? <Check className="w-3.5 h-3.5" /> : n}
            </div>
            <span className={`text-sm ${wizardStep === n ? 'font-medium' : 'text-text-secondary'}`}>
              {label}
            </span>
            {n < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Audience ─────────────────────────────────────── */}
      {wizardStep === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-medium">Who do you want to reach?</h2>

          {/* Audience mode tabs — color-coded pills, one identity per method */}
          <div className="flex flex-wrap gap-2">
            {(['contacts', 'groups', 'phones', 'segment'] as AudienceMode[]).map((mode) => {
              const palette: Record<AudienceMode | 'file' | 'ai', { active: string; inactive: string }> = {
                contacts: { active: 'bg-blue-500 text-white shadow-sm shadow-blue-500/30', inactive: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/15' },
                groups:   { active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30', inactive: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' },
                phones:   { active: 'bg-slate-500 text-white shadow-sm shadow-slate-500/30', inactive: 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/15' },
                segment:  { active: 'bg-violet-500 text-white shadow-sm shadow-violet-500/30', inactive: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/15' },
                file:     { active: '', inactive: '' },
                ai:       { active: '', inactive: '' },
              };
              const colors = palette[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setAudienceMode(mode)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${
                    audienceMode === mode ? colors.active : colors.inactive
                  }`}
                >
                  {mode === 'contacts' ? 'Contacts' : mode === 'groups' ? 'Groups' : mode === 'phones' ? 'Phone numbers' : 'Saved segment'}
                </button>
              );
            })}
          </div>

          {/* Audience content — surface bg, no border */}
          <div className="bg-surface-secondary rounded-2xl p-5 min-h-[200px]">

            {/* ── Contacts: search + select ─────────────────────────── */}
            {audienceMode === 'contacts' && (
              <div className="space-y-3">
                {/* Selected chips */}
                {selectedContacts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-3 border-b border-white/5">
                    {selectedContacts.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs font-medium"
                      >
                        {c.name || c.phone || `#${c.id}`}
                        <button onClick={() => removeContact(c.id)} className="p-0.5 rounded-full hover:bg-blue-500/20 transition">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <span className="text-[11px] text-text-secondary self-center ml-1">
                      {selectedContacts.length} selected
                    </span>
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts by name or phone…"
                    className="w-full pl-9 pr-3 py-2.5 bg-surface/80 rounded-xl text-sm placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                  />
                  {contactSearchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-text-secondary" />
                  )}
                </div>

                {/* Search results */}
                {contactResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-xl bg-surface/60 divide-y divide-white/5">
                    {contactResults.map((c) => {
                      const isSelected = selectedContactIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleContact(c)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition ${
                            isSelected ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className={`w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? 'bg-blue-500 text-white' : 'ring-1 ring-white/20'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{c.name || 'Unnamed'}</div>
                            <div className="text-xs text-text-secondary truncate">
                              {c.phone}{c.email ? ` · ${c.email}` : ''}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {contactSearch.trim() && !contactSearchLoading && contactResults.length === 0 && (
                  <p className="text-xs text-text-secondary text-center py-6">
                    No contacts found for &quot;{contactSearch}&quot;
                  </p>
                )}

                {!contactSearch.trim() && selectedContacts.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-text-secondary">
                    <Search className="w-6 h-6 mb-2 opacity-40" />
                    <p className="text-sm">Start typing to search your CRM contacts</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Groups: checkbox list ─────────────────────────────── */}
            {audienceMode === 'groups' && (
              <div>
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                  </div>
                ) : allGroups.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-text-secondary">
                    <Users className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No contact groups yet</p>
                    <p className="text-xs mt-1 opacity-70">Create groups in your contact manager first</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {allGroups.map((g) => {
                      const isSelected = selectedGroupIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleGroup(g)}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm transition ${
                            isSelected
                              ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? 'bg-emerald-500 text-white' : 'ring-1 ring-white/20'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: g.color || '#10b981' }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{g.name}</span>
                          </div>
                          <span className="text-[11px] text-text-secondary/70 tabular-nums flex-shrink-0">
                            {g.member_count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Phone numbers: textarea ───────────────────────────── */}
            {audienceMode === 'phones' && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">Enter phone numbers — one per line, with country code</p>
                <textarea
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  placeholder={"+919876543210\n+919876543211"}
                  className="w-full px-3.5 py-3 bg-surface/80 rounded-xl text-sm font-mono h-36 resize-none placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-slate-400/40 transition"
                />
                {phones.trim() && (
                  <p className="text-xs text-text-secondary">
                    {phones.split(/[\n,]+/).filter((p) => p.trim()).length} phone numbers entered
                  </p>
                )}
              </div>
            )}

            {/* ── Saved segment: picker with details ────────────────── */}
            {audienceMode === 'segment' && (
              <div>
                {segmentsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                  </div>
                ) : allSegments.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-text-secondary">
                    <Users className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">No saved segments yet</p>
                    <p className="text-xs mt-1 opacity-70">Create a segment from the campaigns page first</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {allSegments.map((seg) => {
                      const isSelected = segmentId === seg.id;
                      return (
                        <button
                          key={seg.id}
                          onClick={() => setSegmentId(isSelected ? null : seg.id)}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm transition ${
                            isSelected
                              ? 'bg-violet-500/10 ring-1 ring-violet-500/30'
                              : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 transition ${
                            isSelected ? 'bg-violet-500 text-white' : 'ring-1 ring-white/20'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{seg.name}</div>
                            {seg.description && (
                              <div className="text-xs text-text-secondary/70 truncate">{seg.description}</div>
                            )}
                          </div>
                          {seg.cached_count != null && (
                            <span className="text-[11px] text-text-secondary/70 tabular-nums flex-shrink-0">
                              ~{seg.cached_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audience count summary — tinted to match the active method's color */}
          {audienceCount != null && audienceCount > 0 && (() => {
            const tint = {
              contacts: 'bg-blue-500/10 text-blue-400',
              groups: 'bg-emerald-500/10 text-emerald-400',
              phones: 'bg-slate-500/10 text-slate-400',
              segment: 'bg-violet-500/10 text-violet-400',
              file: '', ai: '',
            }[audienceMode];
            return (
              <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${tint}`}>
                <Users className="w-4 h-4" />
                <span className="text-sm">
                  <span className="font-semibold">{audienceCount}</span>
                  <span className="text-text-secondary"> contact{audienceCount !== 1 ? 's' : ''} in audience</span>
                </span>
              </div>
            );
          })()}

          {/* Auto-enroll toggle — only for groups or segment when building a sequence */}
          {(audienceMode === 'groups' || audienceMode === 'segment') && (
            <div className="bg-surface-secondary rounded-2xl p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-9 h-5 rounded-full transition-colors ${autoEnrollEnabled ? 'bg-accent' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoEnrollEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  <input
                    type="checkbox"
                    checked={autoEnrollEnabled}
                    onChange={(e) => setAutoEnrollEnabled(e.target.checked)}
                    className="sr-only"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium">Auto-enroll new contacts</div>
                  <div className="text-xs text-text-secondary/70">
                    When new contacts join this {audienceMode === 'groups' ? 'group' : 'segment'}, enroll them automatically
                  </div>
                </div>
              </label>
              {autoEnrollEnabled && (
                <div className="mt-4 ml-12 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5">Max / day</label>
                      <input
                        type="number"
                        value={autoEnrollMaxPerDay}
                        onChange={(e) => setAutoEnrollMaxPerDay(Math.max(1, Number(e.target.value)))}
                        min={1}
                        className="w-full px-3 py-2 bg-surface/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5">Monthly cap</label>
                      <input
                        type="number"
                        value={autoEnrollMonthlyCap ?? ''}
                        onChange={(e) => setAutoEnrollMonthlyCap(e.target.value ? Number(e.target.value) : null)}
                        placeholder="Unlimited"
                        min={1}
                        className="w-full px-3 py-2 bg-surface/80 rounded-lg text-sm placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-text-secondary/60">
                    Auto-pauses on low credits or if a single batch exceeds 100 contacts.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setWizardStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:brightness-110 transition"
            >
              Next: Message <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Message steps ────────────────────────────────── */}
      {wizardStep === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-medium">What do you want to send?</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Build your message. Add more steps to create a multi-step sequence.
            </p>
          </div>

          {/* Campaign name + channel — combined card */}
          <div className="bg-surface-secondary rounded-2xl p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                Campaign name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. June promo blast"
                className="w-full px-3.5 py-2.5 bg-surface/80 rounded-xl text-sm placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              />
            </div>

            {!isSequence && (
              <div>
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                  WhatsApp channel
                </label>
                <select
                  value={channelId || ''}
                  onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3.5 py-2.5 bg-surface/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                >
                  <option value="">Select channel…</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Step builder timeline */}
          <div>
            {steps.map((step, idx) => {
              const isConfigured = !!step.templateId;
              const isOpen = editingStep === idx;
              return (
                <div key={idx} className="flex gap-3 mb-2.5">
                  {/* Timeline line + circle */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      isConfigured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {idx + 1}
                    </div>
                    {idx < steps.length - 1 && <div className="w-0.5 flex-1 bg-white/10 mt-1 rounded-full" />}
                  </div>

                  {/* Step card */}
                  <div
                    className={`flex-1 rounded-2xl p-4 transition cursor-pointer ${
                      isOpen ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-surface-secondary hover:bg-surface-secondary/70'
                    }`}
                    onClick={() => setEditingStep(isOpen ? null : idx)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          Step {idx + 1}
                          <span className="text-text-secondary font-normal">
                            {idx === 0 ? ' — send immediately' : ` — ${step.delayDays}d ${step.delayHours}h after step ${idx}`}
                          </span>
                        </div>
                        {step.templateName ? (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[11px] font-medium">
                              <MessageSquare className="w-2.5 h-2.5" /> {step.templateName}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 mt-1.5 bg-amber-500/15 text-amber-400 rounded-full text-[11px] font-medium">
                            No template selected
                          </span>
                        )}
                      </div>
                      {steps.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeStep(idx); }}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Expanded editor */}
                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Delay (not for step 1) */}
                        {idx > 0 && (
                          <div>
                            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                              Send after
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={step.delayDays}
                                onChange={(e) => updateStep(idx, { delayDays: parseInt(e.target.value) || 0 })}
                                className="w-16 px-2.5 py-1.5 bg-surface/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                              />
                              <span className="text-xs text-text-secondary">days</span>
                              <input
                                type="number"
                                min={0}
                                max={23}
                                value={step.delayHours}
                                onChange={(e) => updateStep(idx, { delayHours: parseInt(e.target.value) || 0 })}
                                className="w-16 px-2.5 py-1.5 bg-surface/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                              />
                              <span className="text-xs text-text-secondary">hours</span>
                            </div>
                          </div>
                        )}

                        {/* Template selector */}
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                            WhatsApp template
                          </label>
                          <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                            {templates.map((tmpl) => (
                              <div
                                key={tmpl.id}
                                onClick={() => updateStep(idx, {
                                  templateId: tmpl.id,
                                  templateName: tmpl.name,
                                  templateBody: tmpl.body,
                                })}
                                className={`rounded-xl p-2.5 cursor-pointer transition text-xs ${
                                  step.templateId === tmpl.id
                                    ? 'bg-accent/15 ring-1 ring-accent/40'
                                    : 'bg-surface/60 hover:bg-surface/90'
                                }`}
                              >
                                <div className="font-medium">{tmpl.name}</div>
                                <div className="text-text-secondary line-clamp-2 mt-0.5">{tmpl.body}</div>
                              </div>
                            ))}
                            {templates.length === 0 && (
                              <p className="text-xs text-text-secondary p-2">
                                No approved templates found. Create one in Message Templates first.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Send window */}
                        <div>
                          <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5 block">
                            Send window
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="time"
                              value={step.sendWindowStart}
                              onChange={(e) => updateStep(idx, { sendWindowStart: e.target.value })}
                              className="px-2.5 py-1.5 bg-surface/80 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                            />
                            <span className="text-xs text-text-secondary">to</span>
                            <input
                              type="time"
                              value={step.sendWindowEnd}
                              onChange={(e) => updateStep(idx, { sendWindowEnd: e.target.value })}
                              className="px-2.5 py-1.5 bg-surface/80 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-text-secondary ml-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={step.skipWeekends}
                                onChange={(e) => updateStep(idx, { skipWeekends: e.target.checked })}
                                className="rounded accent-accent"
                              />
                              Skip weekends
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add step button */}
            <button
              onClick={addNewStep}
              className="w-full mt-1 py-3 rounded-2xl text-sm text-text-secondary bg-surface-secondary/50 hover:bg-accent/10 hover:text-accent transition flex items-center justify-center gap-1.5 border border-dashed border-white/10 hover:border-accent/30"
            >
              <Plus className="w-4 h-4" /> Add step
            </button>
          </div>

          {/* Info badge */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-500/10 rounded-xl text-xs">
            <span className="inline-flex items-center px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full font-semibold flex-shrink-0">
              {isSequence ? `${steps.length}-step sequence` : 'Blast campaign'}
            </span>
            <span className="text-text-secondary">
              {isSequence
                ? 'Contacts receive each step with the configured delay between them.'
                : 'Add more steps to turn this into a multi-step sequence with delays.'
              }
            </span>
          </div>

          {/* Reply handling (shows when 2+ steps) */}
          {isSequence && (
            <div className="bg-surface-secondary rounded-2xl p-4">
              <label className="text-sm font-medium mb-2.5 block">When a contact replies</label>
              <div className="flex gap-2 flex-wrap">
                {(['pause', 'stop', 'continue'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOnReply(opt)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                      onReply === opt
                        ? 'bg-accent text-white'
                        : 'bg-surface/60 text-text-secondary hover:bg-surface/90'
                    }`}
                  >
                    {opt === 'pause' ? 'Pause sequence' : opt === 'stop' ? 'Stop sequence' : 'Continue sending'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizardStep(1)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setWizardStep(3)}
              disabled={!steps[0].templateId}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
            >
              Next: Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ───────────────────────────────────────── */}
      {wizardStep === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-medium">Review &amp; launch</h2>

          {/* Schedule */}
          {!isSequence && (
            <div className="bg-surface-secondary rounded-2xl p-4">
              <label className="text-sm font-medium mb-2.5 block">When to send</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setScheduleType('now')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                    scheduleType === 'now'
                      ? 'bg-accent text-white'
                      : 'bg-surface/60 text-text-secondary hover:bg-surface/90'
                  }`}
                >
                  Send now
                </button>
                <button
                  onClick={() => setScheduleType('scheduled')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                    scheduleType === 'scheduled'
                      ? 'bg-accent text-white'
                      : 'bg-surface/60 text-text-secondary hover:bg-surface/90'
                  }`}
                >
                  Schedule for later
                </button>
              </div>
              {scheduleType === 'scheduled' && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="px-3.5 py-2 bg-surface/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                />
              )}
            </div>
          )}

          {/* Summary card */}
          <div className="bg-surface-secondary rounded-2xl p-5 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium">{name || '(unnamed)'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Type</span>
              <span className="inline-flex items-center px-2.5 py-1 bg-violet-500/15 text-violet-400 rounded-full text-xs font-semibold">
                {isSequence ? `${steps.length}-step sequence` : 'Blast campaign'}
              </span>
            </div>
            {audienceCount != null && audienceCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Audience</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs font-semibold">
                  <Users className="w-3 h-3" /> {audienceCount} contact{audienceCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {steps.map((s, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-text-secondary">Step {i + 1} template</span>
                <span className="font-medium">{s.templateName || '—'}</span>
              </div>
            ))}
            <div className="pt-3 mt-1 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" /> Estimated credits
                </span>
                <span className="font-semibold text-amber-400">
                  {totalCredits > 0 ? `${totalCredits} credits` : '—'}
                </span>
              </div>
              {credits && (
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-text-secondary">Your balance</span>
                  <span className={credits.balance_credits < totalCredits ? 'text-red-400 font-medium' : 'text-text-secondary'}>
                    {credits.balance_credits} credits
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setWizardStep(2)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleLaunch}
              disabled={loading || !steps[0].templateId}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:brightness-110 transition disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {isSequence ? 'Create & activate sequence' : scheduleType === 'scheduled' ? 'Schedule campaign' : 'Launch campaign'}
            </button>
          </div>
        </div>
      )}
      {/* Backfill modal */}
      {showBackfillModal && pendingSequenceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="w-10 h-10 rounded-full bg-accent/15 text-accent flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold mb-2">Enroll existing members?</h3>
            <p className="text-sm text-text-secondary mb-5">
              There are <span className="font-semibold text-accent">{backfillCount}</span> existing members in this {audienceMode === 'groups' ? 'group' : 'segment'} who are not yet enrolled. Enroll them now?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowBackfillModal(false);
                  router.push(`/campaigns/seq-${pendingSequenceId}`);
                }}
                className="px-3.5 py-2 text-sm bg-surface-secondary rounded-xl hover:bg-surface-secondary/70 transition"
              >
                No, new only
              </button>
              <button
                onClick={async () => {
                  try {
                    await backfillExistingMembers(pendingSequenceId);
                  } catch {}
                  setShowBackfillModal(false);
                  router.push(`/campaigns/seq-${pendingSequenceId}`);
                }}
                className="px-3.5 py-2 text-sm bg-accent text-white rounded-xl hover:brightness-110 transition"
              >
                Yes, enroll now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
