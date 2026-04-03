'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { CustomerFilters } from '@/components/customers/customer-filters';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { CreateLeadModal } from '@/components/customers/create-lead-modal';
import { LeadStatsCard } from '@/components/customers/lead-stats-card';
import { LeadFieldConfigPanel } from '@/components/customers/lead-field-config-panel';
import { useShallow } from 'zustand/react/shallow';
import { useCustomerStore } from '@/lib/customer-store';
import { useLeadStats } from '@/lib/hooks/use-reference-data';
import type { CustomerFilters as CustomerFiltersType } from '@/services/customers';
import { listLeadFields, getVisibleFields, type LeadFieldConfig } from '@/services/lead-fields';
import dynamic from 'next/dynamic';
const LeadAnalyticsDashboard = dynamic(
  () => import('@/components/customers/lead-analytics-dashboard').then(m => m.LeadAnalyticsDashboard),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-bg-secondary rounded-lg" /> }
);
import { LeadPipelineBoard } from '@/components/leads/lead-pipeline-board';
import { PipelineEditorModal } from '@/components/leads/pipeline-editor-modal';
import { listPipelineStages, moveLeadToStage, type LeadPipelineStage } from '@/services/customers';

const DEFAULT_PAGE_SIZE = 25;

function initialFiltersFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): CustomerFiltersType & { page: number; perPage: number } {
  const assignedToId = searchParams.get('assigned_to_id');
  const channelIdParam = searchParams.get('channel_id');
  let base: CustomerFiltersType & { page: number; perPage: number } = {
    page: 1,
    perPage: DEFAULT_PAGE_SIZE,
  };
  if (assignedToId) {
    const id = parseInt(assignedToId, 10);
    if (!Number.isNaN(id)) base = { ...base, assignedToId: id, assignedFilter: 'all' as const };
  }
  if (channelIdParam) {
    const channelId = parseInt(channelIdParam, 10);
    if (!Number.isNaN(channelId)) base = { ...base, channelId };
  }
  return base;
}

function formatLastActivity(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function channelTypeLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
}

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => initialFiltersFromSearchParams(searchParams), [searchParams]);
  const { customers, list, listAppend, total, loadingList, deleteLead } = useCustomerStore(
    useShallow((s) => ({
      customers: s.customers,
      list: s.list,
      listAppend: s.listAppend,
      total: s.total,
      loadingList: s.loadingList,
      deleteLead: s.deleteLead,
    }))
  );
  const { data: leadStats } = useLeadStats();

  const [filters, setFilters] = useState(initialFilters);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pageView, setPageView] = useState<'list' | 'pipeline' | 'analytics'>('list');
  const [pipelineStages, setPipelineStages] = useState<LeadPipelineStage[]>([]);
  const [pipelineEditorOpen, setPipelineEditorOpen] = useState(false);
  const [closedFilter, setClosedFilter] = useState<'all' | 'open' | 'closed'>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const [fieldConfigs, setFieldConfigs] = useState<LeadFieldConfig[]>([]);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const isLoadMoreRef = useRef(false);

  // Custom fields: visible non-system, non-relation fields (shown as data cells)
  const customColumns = useMemo(
    () => getVisibleFields(fieldConfigs).filter((f) => !f.is_system && f.field_type !== 'relation'),
    [fieldConfigs]
  );
  // Relation fields: visible relation-type fields (shown as count badges)
  const relationColumns = useMemo(
    () => getVisibleFields(fieldConfigs).filter((f) => f.field_type === 'relation' && !f.is_system),
    [fieldConfigs]
  );

  useEffect(() => {
    listLeadFields().then(setFieldConfigs).catch(() => {});
  }, [showFieldConfig]); // reload after closing config panel

  useEffect(() => {
    listPipelineStages().then(setPipelineStages).catch(() => {});
  }, []);

  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    setFilters((prev) => {
      const next = initialFiltersFromSearchParams(searchParams);
      if (
        next.assignedToId !== prev.assignedToId ||
        next.assignedFilter !== prev.assignedFilter ||
        next.channelId !== prev.channelId
      )
        return next;
      return prev;
    });
  }, [searchParams]);

  useEffect(() => {
    if (isLoadMoreRef.current) {
      isLoadMoreRef.current = false;
      return;
    }
    void list(filters);
  }, [filters]);


  const filteredCustomers = useMemo(() => {
    if (closedFilter === 'open') return customers.filter((c) => !c.pipeline_stage_type || c.pipeline_stage_type === 'open');
    if (closedFilter === 'closed') return customers.filter((c) => c.pipeline_stage_type === 'won' || c.pipeline_stage_type === 'lost');
    return customers;
  }, [customers, closedFilter]);

  const isEmpty = !loadingList && filteredCustomers.length === 0;

  const segmentParts: string[] = [];
  if (filters.pipelineStageId) segmentParts.push('Pipeline stage filter');
  if (filters.priority) segmentParts.push(`Priority: ${filters.priority}`);
  if (filters.source) segmentParts.push(`Source: ${filters.source.replace('_', ' ')}`);
  if (filters.channelId != null) segmentParts.push('Channel filter');
  if (filters.assignedFilter === 'me') segmentParts.push('Assigned: me');
  if (filters.assignedFilter === 'unassigned') segmentParts.push('Unassigned');
  const segmentSummary = segmentParts.length > 0 ? segmentParts.join(' · ') : null;

  const handleSegmentClick = (partial: Partial<CustomerFiltersType>) => {
    applyFilters(partial);
  };

  const hasMore = customers.length < total;

  const handleLoadMore = () => {
    const nextPage = (filters.page || 1) + 1;
    const nextFilters = { ...filters, page: nextPage };
    isLoadMoreRef.current = true;
    setFilters(nextFilters);
    void listAppend(nextFilters);
  };

  // When filters change (except page increment for load-more), reset to page 1
  const applyFilters = (next: Partial<CustomerFiltersType>) => {
    setFilters((f) => ({ ...f, ...next, page: 1 }));
  };

  return (
    <>
        <div className="flex w-full flex-col h-[calc(100vh-4rem)] gap-4">
          <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Leads</h2>
              <p className="text-base text-text-secondary">Manage your leads and lead activity.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/lead-templates"
                className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
              >
                Manage templates
              </Link>
              <button
                type="button"
                onClick={() => setShowFieldConfig(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
                title="Customize columns and source mapping"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Columns
              </button>
              <Link
                href="/leads/import"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Import
              </Link>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                + Create Lead
              </button>
            </div>
          </div>

          {/* View toggle + Open/Closed quick-filter */}
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border-color overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setPageView('list')}
                className={`px-4 py-2 transition-colors ${pageView === 'list' ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  List
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPageView('pipeline')}
                className={`px-4 py-2 transition-colors border-l border-border-color ${pageView === 'pipeline' ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Pipeline
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPageView('analytics')}
                className={`px-4 py-2 transition-colors border-l border-border-color ${pageView === 'analytics' ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analytics
                </span>
              </button>
            </div>

            {/* Open / Closed quick-filter (list view only) */}
            {pageView === 'list' && (
              <div className="flex gap-1">
                {(['all', 'open', 'closed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setClosedFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      closedFilter === f
                        ? f === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : f === 'closed' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          : 'bg-accent/10 text-accent'
                        : 'border border-border-color text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {pageView === 'pipeline' && (
            <>
              <LeadPipelineBoard
                leads={customers}
                stages={pipelineStages}
                onMoveStage={async (leadId, stageId) => {
                  await moveLeadToStage(leadId, stageId);
                  // Refresh data
                  void listPipelineStages().then(setPipelineStages);
                  void list(filters);
                }}
                onLeadClick={(leadId) => router.push(`/leads/${leadId}`)}
                onEditPipeline={() => setPipelineEditorOpen(true)}
              />
              <PipelineEditorModal
                isOpen={pipelineEditorOpen}
                onClose={() => setPipelineEditorOpen(false)}
                stages={pipelineStages}
                onSave={() => {
                  void listPipelineStages().then(setPipelineStages);
                  setPipelineEditorOpen(false);
                }}
              />
            </>
          )}

          {pageView === 'analytics' && (
            <LeadAnalyticsDashboard />
          )}

          {pageView === 'list' && (
            <>
            <CustomerFilters initial={filters} onApply={applyFilters} />

          {/* Segment summary bar */}
          {!loadingList && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2 text-sm text-text-secondary shrink-0">
              <span className="font-medium text-text-primary">
                {filteredCustomers.length} of {total} leads
              </span>
              {segmentSummary && (
                <>
                  <span aria-hidden>·</span>
                  <span>{segmentSummary}</span>
                </>
              )}
            </div>
          )}

          {loadingList && customers.length === 0 && <div className="text-base text-text-secondary">Loading leads…</div>}

          {isEmpty && (
            <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-base text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">No leads found</p>
              <p className="mb-4">Messages will automatically create leads. Adjust filters to see results.</p>
            </div>
          )}

          {!isEmpty && (
            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Lead</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Contact</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Stage</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Priority</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Score</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Source</th>
                    {/* Dynamic custom field columns */}
                    {customColumns.map((f) => (
                      <th key={f.id} className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary whitespace-nowrap">
                        {f.display_name}
                      </th>
                    ))}
                    {/* Relation columns */}
                    {relationColumns.map((f) => {
                      const cfg = f.config as Record<string, unknown> | undefined;
                      const dsName = cfg?.datasheet_name as string | undefined;
                      return (
                        <th key={f.id} className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary whitespace-nowrap">
                          {dsName ?? f.display_name}
                        </th>
                      );
                    })}
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Last activity</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Agent</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Mode</th>
                    <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-bg-secondary/60">
                      <td className="px-4 py-2.5">
                        <div className="text-base font-semibold text-text-primary">{c.name || 'Unknown'}</div>
                        {c.lastMessagePreview && c.lastMessagePreview !== '—' && (
                          <div className="mt-0.5 line-clamp-1 text-sm text-text-secondary">{c.lastMessagePreview}</div>
                        )}
                        {c.createdAt && (
                          <div className="mt-0.5 text-xs text-text-secondary">Created {formatShortDate(c.createdAt)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-base text-text-primary">{c.phone || '—'}</div>
                        {c.email && (
                          <div className="mt-0.5 text-sm text-text-secondary">{c.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.pipelineStageName ? (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold"
                            style={c.pipelineStageColor ? { backgroundColor: c.pipelineStageColor + '20', color: c.pipelineStageColor } : undefined}
                          >
                            {c.pipelineStageName}
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.priority ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                            c.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                            c.priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300'
                          }`}>
                            {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.leadScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-bg-secondary">
                              <div
                                className={`h-full ${
                                  c.leadScore >= 71 ? 'bg-green-500' :
                                  c.leadScore >= 31 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, c.leadScore)}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-text-primary">{Math.round(c.leadScore)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.linkedChannels && c.linkedChannels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.linkedChannels.map((lc) => (
                              <span
                                key={`${lc.channel_id}-${lc.channel_identifier}`}
                                className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              >
                                {channelTypeLabel(lc.channel_type)}
                              </span>
                            ))}
                          </div>
                        ) : c.source ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            {c.source.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      {/* Dynamic custom field cells */}
                      {customColumns.map((f) => {
                        const val = c.custom_fields?.[f.field_key];
                        return (
                          <td key={f.id} className="px-4 py-2.5 text-sm text-text-primary whitespace-nowrap">
                            <DynamicCell field={f} value={val} />
                          </td>
                        );
                      })}
                      {/* Relation count cells */}
                      {relationColumns.map((f) => {
                        const cfg = f.config as Record<string, unknown> | undefined;
                        const target = cfg?.target as string ?? 'work';
                        // Datasheet relations are keyed by datasheet_<id> in relations_summary
                        const summaryKey =
                          target === 'datasheet' && cfg?.datasheet_id
                            ? `datasheet_${cfg.datasheet_id}`
                            : target;
                        const count = c.relations_summary?.[summaryKey] ?? 0;
                        return (
                          <td key={f.id} className="px-4 py-2.5">
                            {count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                                {count}
                              </span>
                            ) : (
                              <span className="text-text-secondary text-sm">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-secondary">
                        {formatLastActivity(c.lastActivity)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex max-w-[140px] items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                            c.assignedAgent && c.assignedAgent !== '—'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
                          }`}
                          title="Agent is inferred from the latest conversation for this lead."
                        >
                          {c.assignedAgent && c.assignedAgent !== '—' ? c.assignedAgent : 'Unassigned'}
                        </span>
                        <div className="mt-0.5 text-xs text-text-secondary">Latest conversation</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <AIStatusBadge mode={c.aiActive ? 'ai' : 'manual'} />
                      </td>
                      <td className="relative px-4 py-2.5 text-right">
                        <div className="relative flex justify-end" ref={openMenuId === c.id ? menuRef : undefined}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) => (prev === c.id ? null : c.id));
                            }}
                            className="rounded-lg border border-border-color bg-bg-primary p-2 text-text-secondary hover:border-accent hover:text-text-primary"
                            aria-expanded={openMenuId === c.id}
                            aria-haspopup="true"
                            aria-label="Actions menu"
                          >
                            <span className="sr-only">Actions</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {openMenuId === c.id && (
                            <div
                              className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border-color bg-card-bg py-1 shadow-lg"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  router.push(`/leads/${c.id}`);
                                }}
                              >
                                Profile
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  router.push(`/leads/${c.id}`);
                                }}
                              >
                                Edit
                              </button>
                              {c.latestConversationId ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    router.push(`/conversations/${c.latestConversationId}`);
                                  }}
                                >
                                  Conversation
                                </button>
                              ) : (
                                <span
                                  className="block w-full px-4 py-2 text-left text-sm text-text-secondary"
                                  title="No conversation yet"
                                >
                                  Conversation
                                </span>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-bg-secondary dark:text-red-400"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  if (!confirm('Are you sure you want to delete this lead? This cannot be undone.')) return;
                                  try {
                                    await deleteLead(c.id);
                                  } catch (err) {
                                    console.error('Failed to delete lead:', err);
                                    alert('Failed to delete lead. Please try again.');
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="shrink-0 border-t border-border-color px-4 py-3 text-center">
                  <button
                    type="button"
                    disabled={loadingList}
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-5 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50 transition-colors"
                  >
                    {loadingList ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading…
                      </>
                    ) : (
                      <>Load more ({total - customers.length} remaining)</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
    <CreateLeadModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} fieldConfigs={fieldConfigs} />

    {/* Field config slide-over */}
    {showFieldConfig && (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="flex-1 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowFieldConfig(false)}
        />
        {/* Panel */}
        <div className="w-full max-w-md bg-bg-primary shadow-2xl flex flex-col h-full">
          <LeadFieldConfigPanel onClose={() => setShowFieldConfig(false)} />
        </div>
      </div>
    )}
    </>
  );
}

// ─── Dynamic cell renderer ─────────────────────────────────────────────────────

function DynamicCell({ field, value }: { field: LeadFieldConfig; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-text-secondary">—</span>;
  }

  const str = String(value);

  if (field.field_type === 'boolean') {
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        value === true || str === 'true' || str === '1'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
      }`}>
        {value === true || str === 'true' || str === '1' ? 'Yes' : 'No'}
      </span>
    );
  }

  if (field.field_type === 'select') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
        {str}
      </span>
    );
  }

  if (field.field_type === 'date' || field.field_type === 'datetime') {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return (
        <span className="text-text-primary">
          {field.field_type === 'datetime'
            ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      );
    }
  }

  if (field.field_type === 'url') {
    return (
      <a href={str} target="_blank" rel="noopener noreferrer" className="text-accent underline text-xs truncate max-w-[120px] block">
        {str}
      </a>
    );
  }

  if (field.field_type === 'number') {
    return <span className="font-mono text-text-primary">{str}</span>;
  }

  // text / email / phone / textarea
  return (
    <span className="text-text-primary truncate max-w-[160px] block" title={str}>{str}</span>
  );
}

export default function LeadsClient() {
  return (
    <Suspense fallback={
      <div className="w-full space-y-4">
        <span className="text-sm text-text-secondary">Loading...</span>
      </div>
    }>
      <CustomersContent />
    </Suspense>
  );
}
