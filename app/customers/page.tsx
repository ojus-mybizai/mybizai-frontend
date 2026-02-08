'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { CustomerFilters } from '@/components/customers/customer-filters';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { CreateLeadModal } from '@/components/customers/create-lead-modal';
import { LeadStatsCard } from '@/components/customers/lead-stats-card';
import { useShallow } from 'zustand/react/shallow';
import { useCustomerStore } from '@/lib/customer-store';
import type { CustomerFilters as CustomerFiltersType } from '@/services/customers';

const PER_PAGE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

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
  const { customers, list, total, totalPages, page, loadingList, leadStats, loadLeadStats, deleteLead } = useCustomerStore(
    useShallow((s) => ({
      customers: s.customers,
      list: s.list,
      total: s.total,
      totalPages: s.totalPages,
      page: s.page,
      loadingList: s.loadingList,
      leadStats: s.leadStats,
      loadLeadStats: s.loadLeadStats,
      deleteLead: s.deleteLead,
    }))
  );

  const [filters, setFilters] = useState(initialFilters);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    void list(filters);
  }, [filters]);

  useEffect(() => {
    void loadLeadStats();
  }, []);

  const isEmpty = !loadingList && customers.length === 0;
  const perPage = filters.perPage ?? DEFAULT_PAGE_SIZE;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const segmentParts: string[] = [];
  if (filters.status) segmentParts.push(`Status: ${filters.status}`);
  if (filters.priority) segmentParts.push(`Priority: ${filters.priority}`);
  if (filters.source) segmentParts.push(`Source: ${filters.source.replace('_', ' ')}`);
  if (filters.channelId != null) segmentParts.push('Channel filter');
  if (filters.assignedFilter === 'me') segmentParts.push('Assigned: me');
  if (filters.assignedFilter === 'unassigned') segmentParts.push('Unassigned');
  const segmentSummary = segmentParts.length > 0 ? segmentParts.join(' · ') : null;

  const handleSegmentClick = (partial: Partial<CustomerFiltersType>) => {
    setFilters((f) => ({ ...f, ...partial, page: 1 }));
  };

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <div className="w-full space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                + Create Lead
              </button>
            </div>
          </div>

          {leadStats && (
            <LeadStatsCard
              stats={leadStats}
              onSegmentClick={handleSegmentClick}
            />
          )}

          <CustomerFilters initial={filters} onApply={(next) => setFilters((f) => ({ ...f, ...next }))} />

          {/* Segment summary bar */}
          {!loadingList && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                Showing {total === 0 ? '0' : `${start}–${end}`} of {total} leads
              </span>
              {segmentSummary && (
                <>
                  <span aria-hidden>·</span>
                  <span>{segmentSummary}</span>
                </>
              )}
            </div>
          )}

          {loadingList && <div className="text-base text-text-secondary">Loading customers…</div>}

          {isEmpty && (
            <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-base text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">No leads found</p>
              <p className="mb-4">Messages will automatically create leads. Adjust filters to see results.</p>
            </div>
          )}

          {!isEmpty && (
            <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Lead</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Contact</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Priority</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Score</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Source</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Last activity</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Agent</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Mode</th>
                    <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {customers.map((c) => (
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
                        {c.status ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                            c.status === 'won' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                            c.status === 'qualified' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                            c.status === 'contacted' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                            c.status === 'lost' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300'
                          }`}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
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
                                  router.push(`/customers/${c.id}`);
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
                                  router.push(`/customers/${c.id}`);
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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color px-4 py-3 text-sm text-text-secondary">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Page {page} of {totalPages} · {total === 0 ? '0' : `${start}–${end}`} of {total} leads
                  </span>
                  <label className="flex items-center gap-2">
                    <span>Per page</span>
                    <select
                      value={perPage}
                      onChange={(e) => setFilters((f) => ({ ...f, perPage: Number(e.target.value) as typeof PER_PAGE_OPTIONS[number], page: 1 }))}
                      className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                    className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
                    className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </ModuleGuard>

        <CreateLeadModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </ProtectedShell>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full space-y-4">
            <span className="text-sm text-text-secondary">Loading...</span>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    }>
      <CustomersContent />
    </Suspense>
  );
}
