'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Plus, SlidersHorizontal, BarChart2, Download,
  FileSpreadsheet, Loader2, Users, Phone, Mail, Building2,
  Tag, Bot, UserCheck, UserX, Trash2, X, Check, ChevronDown,
  Bookmark, BookmarkPlus, FolderKanban, Lock, RefreshCw, LayoutList, MessageSquare, Tags,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useContactV2Store } from '@/lib/contact-v2-store';
import { contactsV2Service } from '@/services/contacts-v2';
import type { Contact, ContactFilters, Priority, RoutingMode, ContactGroup } from '@/services/contacts-v2';
import { CreateContactModal } from '@/components/contacts-v2/create-contact-modal';
import { ContactFilterRail } from '@/components/contacts-v2/contact-filter-rail';
import { ContactAnalytics } from '@/components/contacts-v2/contact-analytics';
import { GroupRoutingPanel } from '@/components/contacts-v2/group-routing-panel';
import { TagPicker } from '@/components/contacts/TagPicker';
import { TagManagerPanel } from '@/components/contacts/TagManagerPanel';
import { gmailIntegrationService, type GmailStatus } from '@/services/gmailIntegration';
import { listChannels, type Channel as BusinessChannel } from '@/services/channels';
import { listSourceDefs, type ContactSourceDef } from '@/services/contact-source-defs';
import { listFieldDefs, type ContactFieldDef } from '@/services/contact-field-defs';
import { ManageFieldsModal } from '@/components/contacts-v2/manage-fields-modal';
import { ManageSourcesModal } from '@/components/contacts-v2/manage-sources-modal';

const PRIORITY_COLORS: Record<Priority, string> = {
  hot:    'text-red-500 bg-red-50 border-red-300',
  high:   'text-orange-500 bg-orange-50 border-orange-300',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-300',
  low:    'text-blue-500 bg-blue-50 border-blue-300',
};
const PRIORITY_LABELS: Record<Priority, string> = {
  hot: '🔥 Hot', high: '↑ High', medium: '— Med', low: '↓ Low',
};
const ROUTING_COLORS: Record<RoutingMode, string> = {
  ai:      'text-green-800 bg-green-50 border-green-300',
  manual:  'text-amber-800 bg-amber-50 border-amber-300',
  blocked: 'text-red-600  bg-red-50   border-red-300',
};

// ── URL ⇄ filter-state sync ────────────────────────────────────────────────
// Contact filters are reflected in the URL query so views are shareable/bookmarkable
// and dashboard widgets can deep-link to a pre-filtered list (e.g. /contacts?source=whatsapp).
const FILTER_STR_KEYS = ['priority', 'routing_mode', 'source', 'engagement', 'created_within', 'attention'] as const;
const FILTER_NUM_KEYS = ['assigned_to_id', 'tag_id', 'channel_id'] as const;
const DEFAULT_SORT_BY = 'created_at';
const DEFAULT_SORT_DIR: 'asc' | 'desc' = 'desc';

function paramsToFilterState(params: URLSearchParams): {
  filters: ContactFilters; groupId: number | null; search: string;
} {
  const filters: ContactFilters = { sort_by: DEFAULT_SORT_BY, sort_dir: DEFAULT_SORT_DIR };
  for (const k of FILTER_STR_KEYS) {
    const v = params.get(k);
    if (v) (filters as Record<string, unknown>)[k] = v;
  }
  for (const k of FILTER_NUM_KEYS) {
    const v = params.get(k);
    if (v != null && v !== '' && !Number.isNaN(Number(v))) {
      (filters as Record<string, unknown>)[k] = Number(v);
    }
  }
  const sortBy = params.get('sort_by');
  if (sortBy) filters.sort_by = sortBy;
  const sortDir = params.get('sort_dir');
  if (sortDir === 'asc' || sortDir === 'desc') filters.sort_dir = sortDir;
  const cf = params.get('custom_filters');
  if (cf) { try { filters.custom_filters = JSON.parse(cf); } catch { /* ignore malformed */ } }

  const g = params.get('group_id');
  const groupId = g != null && g !== '' && !Number.isNaN(Number(g)) ? Number(g) : null;
  const search = params.get('search') ?? '';
  return { filters, groupId, search };
}

function filterStateToParams(
  filters: ContactFilters, groupId: number | null, search: string,
): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of FILTER_STR_KEYS) {
    const v = (filters as Record<string, unknown>)[k];
    if (v != null && v !== '') p.set(k, String(v));
  }
  for (const k of FILTER_NUM_KEYS) {
    const v = (filters as Record<string, unknown>)[k];
    if (v != null) p.set(k, String(v));
  }
  if (filters.custom_filters?.length) p.set('custom_filters', JSON.stringify(filters.custom_filters));
  if (filters.sort_by && filters.sort_by !== DEFAULT_SORT_BY) p.set('sort_by', filters.sort_by);
  if (filters.sort_dir && filters.sort_dir !== DEFAULT_SORT_DIR) p.set('sort_dir', filters.sort_dir);
  if (groupId != null) p.set('group_id', String(groupId));
  if (search) p.set('search', search);
  return p;
}

// Initial filter state derived from the current URL (client-only; SSR falls back to defaults).
function initialFilterState() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  return paramsToFilterState(new URLSearchParams(search));
}

export default function ContactsClient() {
  const {
    contacts: _contacts, total, loading, loadingMore,
    tags: _tags, savedViews: _savedViews,
    groups: _groups,
    filterCounts, loadingFilterCounts,
    selectedIds,
    list, loadMore, refresh,
    remove, bulkAction,
    toggleSelectId, selectAll, clearSelection,
    loadTags, loadSavedViews, loadGroups, loadFilterCounts,
    addToGroup,
    createSavedView, deleteSavedView,
  } = useContactV2Store();

  const contacts = _contacts ?? [];
  const tags = _tags ?? [];
  const savedViews = _savedViews ?? [];
  const groups = _groups ?? [];

  const [initial] = useState(initialFilterState);
  const [filters, setFilters] = useState<ContactFilters>(initial.filters);
  const [search, setSearch] = useState(initial.search);
  const [showCreate, setShowCreate] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showFilterRail, setShowFilterRail] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [savingView, setSavingView] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(initial.groupId);
  const [showGroups, setShowGroups] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [channelInstances, setChannelInstances] = useState<BusinessChannel[]>([]);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [sourceDefs, setSourceDefs] = useState<ContactSourceDef[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ContactFieldDef[]>([]);
  const [showFields, setShowFields] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [showBulkGroupPicker, setShowBulkGroupPicker] = useState(false);
  const [bulkAddingGroup, setBulkAddingGroup] = useState<number | null>(null);
  const bulkGroupRef = useRef<HTMLDivElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active filter count (excluding sort)
  const activeFilterCount = [
    filters.priority,
    filters.assigned_to_id,
    filters.routing_mode,
    filters.tag_id,
    filters.source,
    filters.channel_id,
    filters.engagement,
    filters.created_within,
    filters.attention,
    activeGroupId,
  ].filter(v => v != null).length + (filters.custom_filters?.length ?? 0);

  // Filter-count context — depends only on the active group + search, not on the
  // segment filters themselves (counts show "how many if I applied this").
  const reloadCounts = useCallback(() => {
    void loadFilterCounts({ group_id: activeGroupId, search: search || undefined });
  }, [activeGroupId, search, loadFilterCounts]);

  // Load reference data once
  useEffect(() => {
    if (tags.length === 0) loadTags();
    loadSavedViews();
    loadGroups();
    gmailIntegrationService.getStatus().then(setGmailStatus).catch(() => {});
    listChannels().then(chs => setChannelInstances(chs.filter(c => c.isConnected))).catch(() => {});
    listSourceDefs().then(setSourceDefs).catch(() => {});
  }, []);

  // Load the custom-field defs applicable to the current context: global fields
  // always, plus the active group's scoped fields. Prune any custom filters that
  // reference fields no longer in scope so the filter set stays consistent.
  const loadFieldDefs = useCallback(() => {
    const calls = [listFieldDefs(0)];                       // global only
    if (activeGroupId != null) calls.push(listFieldDefs(activeGroupId));
    Promise.all(calls)
      .then(results => {
        const seen = new Set<number>();
        const merged = results.flat().filter(f => (seen.has(f.id) ? false : seen.add(f.id)));
        setFieldDefs(merged);
        setFilters(f => {
          if (!f.custom_filters?.length) return f;
          const valid = f.custom_filters.filter(cf => seen.has(cf.field_id));
          return valid.length === f.custom_filters.length ? f : { ...f, custom_filters: valid };
        });
      })
      .catch(() => setFieldDefs([]));
  }, [activeGroupId]);

  useEffect(() => { loadFieldDefs(); }, [loadFieldDefs]);

  // Handle ?gmail=connected redirect — auto-trigger sync
  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      gmailIntegrationService.getStatus().then(status => {
        setGmailStatus(status);
        if (status.connected) handleGmailSync();
      }).catch(() => {});
      // Clean the query param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Initial + filter-driven load
  useEffect(() => {
    const merged: ContactFilters = { ...filters };
    if (activeGroupId !== null) merged.group_id = activeGroupId;
    if (search) merged.search = search;
    void list(merged);
  }, [filters, activeGroupId]);

  // Reflect the active filters/group/search in the URL query so the view is
  // shareable and dashboard widgets can deep-link to a pre-filtered list.
  // Uses replaceState (not the router) to avoid a navigation / re-render loop.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = filterStateToParams(filters, activeGroupId, search).toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', next);
    }
  }, [filters, activeGroupId, search]);

  // Reload segment counts when the context (group) changes
  useEffect(() => {
    reloadCounts();
  }, [activeGroupId]);

  // Debounced search — drives both the list and the count badges
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const merged: ContactFilters = { ...filters };
      if (activeGroupId !== null) merged.group_id = activeGroupId;
      if (val) merged.search = val;
      void list(merged);
      void loadFilterCounts({ group_id: activeGroupId, search: val || undefined });
    }, 300);
  };

  // Infinite scroll sentinel
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore) void loadMore();
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore]);

  // Close import menu / bulk group picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImport(false);
      }
      if (bulkGroupRef.current && !bulkGroupRef.current.contains(e.target as Node)) {
        setShowBulkGroupPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFilterPatch = (patch: Partial<ContactFilters>) => {
    setFilters(f => ({ ...f, ...patch }));
  };

  const handleResetFilters = () => {
    setFilters({ sort_by: filters.sort_by, sort_dir: filters.sort_dir });
  };

  const applyGroupFilter = (groupId: number | null) => {
    setActiveGroupId(groupId);
  };

  // Open the contact's conversation in the inbox. If they already have one,
  // deep-link straight to it; otherwise open the inbox composer prefilled so
  // a new conversation can be started.
  const handleOpenConversation = (contact: Contact) => {
    if (contact.latest_conversation_id != null) {
      router.push(`/inbox?c=${contact.latest_conversation_id}`);
      return;
    }
    const params = new URLSearchParams({ new: '1' });
    if (contact.phone) params.set('phone', contact.phone);
    if (contact.name) params.set('name', contact.name);
    router.push(`/inbox?${params.toString()}`);
  };

  const handleApplySavedView = (view: { filters: ContactFilters }) => {
    setFilters(view.filters);
    setActiveGroupId(null);
  };

  const handleSaveView = async () => {
    if (!saveViewName.trim()) return;
    setSavingView(true);
    try {
      const currentFilters: ContactFilters = { ...filters };
      if (search) currentFilters.search = search;
      await createSavedView(saveViewName.trim(), currentFilters);
      setShowSaveView(false);
      setSaveViewName('');
    } finally {
      setSavingView(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await remove(id);
      reloadCounts();
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    await bulkAction({ action: 'delete', contact_ids: Array.from(selectedIds) });
    reloadCounts();
  };

  const handleBulkAddToGroup = async (groupId: number) => {
    if (!selectedIds.size) return;
    setBulkAddingGroup(groupId);
    try {
      await addToGroup(groupId, Array.from(selectedIds));
      setShowBulkGroupPicker(false);
    } finally {
      setBulkAddingGroup(null);
    }
  };

  const handleBulkPriority = async (priority: Priority) => {
    if (!selectedIds.size) return;
    await bulkAction({ action: 'change_priority', contact_ids: Array.from(selectedIds), priority });
    reloadCounts();
  };

  const handleGmailConnect = async () => {
    try {
      const { authUrl } = await gmailIntegrationService.getAuthUrl();
      window.location.href = authUrl;
    } catch {
      setImportMsg('Failed to start Google authorization. Please try again.');
    }
  };

  const handleGmailSync = async () => {
    setGmailSyncing(true);
    try {
      const result = await gmailIntegrationService.sync();
      setImportMsg(`Imported ${result.imported} contacts from Google (${result.skipped} skipped)`);
      const updatedStatus = await gmailIntegrationService.getStatus();
      setGmailStatus(updatedStatus);
      void refresh();
      reloadCounts();
    } catch {
      setImportMsg('Google Contacts sync failed. Please try again.');
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let imported = 0;
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      for (const row of rows) {
        const name  = row['Name']  ?? row['name']  ?? '';
        const phone = row['Phone'] ?? row['phone'] ?? row['Mobile'] ?? row['mobile'] ?? '';
        const email = row['Email'] ?? row['email'] ?? '';
        if (!name && !phone) continue;
        try {
          await contactsV2Service.create({ name: name || undefined, phone: phone || undefined, email: email || undefined, contact_source: 'csv' });
          imported++;
        } catch { /* skip duplicates */ }
      }
      setImportMsg(`Imported ${imported} contacts from file`);
      void refresh();
      reloadCounts();
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExport = () => {
    setShowImport(false);
    const ws = XLSX.utils.json_to_sheet(contacts.map(c => ({
      Name: c.name ?? '',
      Phone: c.phone ?? '',
      Email: c.email ?? '',
      Company: c.company ?? '',
      Priority: c.priority,
      Source: c.contact_source ?? '',
      Routing: c.routing_mode,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts.xlsx');
  };

  const allSelected = selectedIds.size === contacts.length && contacts.length > 0;
  const activeGroup = activeGroupId != null ? groups.find(g => g.id === activeGroupId) ?? null : null;

  return (
    <div className="flex flex-col h-full bg-main-bg overflow-hidden">

      {/* ── Analytics panel (collapsible) ─────────────────────── */}
      {showAnalytics && <ContactAnalytics onClose={() => setShowAnalytics(false)} />}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border-color bg-bg-primary">

        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-2.5">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-semibold text-text-primary">Contacts</h1>
            <span className="flex items-center gap-1 text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full border border-border-color">
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin text-accent" />
                : total.toLocaleString()}
            </span>
            {activeGroup && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium text-white px-2.5 py-1 rounded-full"
                style={{ backgroundColor: activeGroup.color ?? '#6366f1' }}
              >
                {activeGroup.is_system ? <Lock className="w-3 h-3" /> : <FolderKanban className="w-3 h-3" />}
                {activeGroup.name}
                <button
                  onClick={() => applyGroupFilter(null)}
                  className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 transition-colors"
                  title="Clear group filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Analytics toggle */}
            <button
              onClick={() => setShowAnalytics(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showAnalytics ? 'bg-accent text-white border-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <BarChart2 className="w-4 h-4" />
              Analytics
            </button>

            {/* Groups */}
            <button
              onClick={() => setShowGroups(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showGroups ? 'bg-accent text-white border-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <FolderKanban className="w-4 h-4" />
              Groups
              {groups.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 rounded-full ${showGroups ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-secondary'}`}>
                  {groups.length}
                </span>
              )}
            </button>

            {/* Import / Export */}
            <div className="relative" ref={importMenuRef}>
              <button
                onClick={() => setShowImport(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border-color rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Import
                <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
              </button>
              {showImport && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-card-bg border border-border-color rounded-xl shadow-lg py-1.5 w-48">
                  <button
                    onClick={() => { setShowImport(false); xlsxRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Import from Excel
                  </button>
                  <div className="border-t border-border-color my-1" />
                  {gmailStatus?.connected ? (
                    <button
                      onClick={() => { setShowImport(false); void handleGmailSync(); }}
                      disabled={gmailSyncing}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary text-left disabled:opacity-60"
                    >
                      {gmailSyncing
                        ? <Loader2 className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />
                        : <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      <span className="flex-1">Sync Google Contacts</span>
                      {gmailStatus.lastSyncAt && (
                        <span className="text-[10px] text-text-secondary/60">
                          {new Date(gmailStatus.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setShowImport(false); void handleGmailConnect(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary text-left"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Import from Google Contacts
                    </button>
                  )}
                  <div className="border-t border-border-color my-1" />
                  <Link
                    href="/contacts/import"
                    onClick={() => setShowImport(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary text-left"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-accent flex-shrink-0" />
                    Advanced Import (with dedup)
                  </Link>
                  <div className="border-t border-border-color my-1" />
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-secondary text-left"
                  >
                    <Download className="w-4 h-4 text-text-secondary flex-shrink-0" />
                    Export to Excel
                  </button>
                </div>
              )}
            </div>
            <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />

            {/* Filters — toggles the smart-filter rail */}
            <button
              onClick={() => setShowFilterRail(o => !o)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilterRail || activeFilterCount > 0 ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Tags */}
            <button
              onClick={() => setShowTagManager(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showTagManager ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <Tag className="w-4 h-4" />
              Tags
            </button>

            {/* Custom fields */}
            <button
              onClick={() => setShowFields(true)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showFields ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <LayoutList className="w-4 h-4" />
              Fields
            </button>

            {/* Sources */}
            <button
              onClick={() => setShowSources(true)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showSources ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}
            >
              <Tags className="w-4 h-4" />
              Sources
            </button>

            {/* Save view */}
            <div className="relative">
              <button
                onClick={() => setShowSaveView(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border-color rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
                title="Save current view"
              >
                <BookmarkPlus className="w-4 h-4" />
              </button>
              {showSaveView && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-card-bg border border-border-color rounded-xl shadow-lg p-3 w-56">
                  <p className="text-xs font-semibold text-text-secondary mb-2">Save current view</p>
                  <input
                    autoFocus
                    value={saveViewName}
                    onChange={e => setSaveViewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveView()}
                    placeholder="View name…"
                    className="w-full px-3 py-1.5 text-sm border border-border-color rounded-lg bg-bg-secondary text-text-primary focus:outline-none focus:border-accent mb-2"
                  />
                  <button
                    onClick={handleSaveView}
                    disabled={savingView || !saveViewName.trim()}
                    className="w-full py-1.5 text-sm rounded-lg bg-accent hover:bg-accent/90 text-white font-medium disabled:opacity-60 flex items-center justify-center gap-1"
                  >
                    {savingView && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => { setEditContact(null); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        </div>

        {/* Group chips + saved views */}
        <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
          {/* All contacts chip */}
          <button
            onClick={() => applyGroupFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeGroupId === null
                ? 'bg-accent text-white border-transparent'
                : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {activeGroupId === null && loading && <Loader2 className="w-3 h-3 animate-spin" />}
              All
            </span>
          </button>

          {/* Group chips */}
          {groups.length > 0 && (
            <>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => applyGroupFilter(activeGroupId === g.id ? null : g.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    activeGroupId === g.id
                      ? 'border-transparent text-white'
                      : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                  }`}
                  style={activeGroupId === g.id ? { backgroundColor: g.color ?? '#6366f1' } : {}}
                >
                  {activeGroupId === g.id && loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : g.is_system ? <Lock className="w-2.5 h-2.5" /> : <FolderKanban className="w-3 h-3" />}
                  {g.name}
                  <span className={`text-[9px] font-bold ${activeGroupId === g.id ? 'text-white/70' : 'text-text-secondary/60'}`}>
                    {g.member_count}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Saved view divider */}
          {savedViews.length > 0 && <div className="w-px h-4 bg-border-color flex-shrink-0 mx-1" />}

          {/* Saved view chips */}
          {savedViews.map(view => (
            <div key={view.id} className="flex-shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => handleApplySavedView(view)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border-color text-text-secondary hover:border-accent hover:text-accent transition-all"
              >
                <Bookmark className="w-3 h-3" />
                {view.name}
              </button>
              <button
                onClick={() => deleteSavedView(view.id)}
                className="p-0.5 rounded-full text-text-secondary/40 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, phone, email, or company…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary focus:outline-none focus:border-accent text-text-primary"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Import feedback ──────────────────────────────────────── */}
      {importMsg && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-300 text-sm text-green-800">
          <Check className="w-4 h-4 flex-shrink-0" />
          {importMsg}
          <button onClick={() => setImportMsg('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Smart-filter rail */}
        {showFilterRail && (
          <ContactFilterRail
            filters={filters}
            counts={filterCounts}
            loadingCounts={loadingFilterCounts}
            tags={tags}
            channelInstances={channelInstances}
            sourceDefs={sourceDefs}
            fieldDefs={fieldDefs}
            onChange={handleFilterPatch}
            onReset={handleResetFilters}
            onCollapse={() => setShowFilterRail(false)}
          />
        )}

        {/* Contact list */}
        <div className="flex-1 overflow-auto flex flex-col">
          {loading ? (
            /* Skeleton on every fetch — initial load, group switch, filter or search change */
            <ContactTableSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState
              onAdd={() => setShowCreate(true)}
              hasFilters={activeFilterCount > 0 || !!search}
              groupName={activeFilterCount === 1 && !search ? activeGroup?.name : undefined}
            />
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead className="bg-bg-secondary border-b border-border-color sticky top-0 z-10">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => allSelected ? clearSelection() : selectAll()}
                        className="rounded accent-accent"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Phone / Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Routing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Tags</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {contacts.map(contact => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      selected={selectedIds.has(contact.id)}
                      active={false}
                      onToggle={() => toggleSelectId(contact.id)}
                      deleting={deletingIds.has(contact.id)}
                      onDelete={() => handleDelete(contact.id)}
                      onOpen={() => router.push(`/contacts/${contact.id}`)}
                      onMessage={() => handleOpenConversation(contact)}
                      groups={groups}
                      onAddToGroup={(groupId) => addToGroup(groupId, [contact.id])}
                    />
                  ))}
                </tbody>
              </table>

              {/* Infinite scroll sentinel + load-more indicator */}
              <div ref={bottomRef} className="flex flex-col items-center py-4 gap-2">
                {loadingMore ? (
                  <LoadMoreIndicator loaded={contacts.length} total={total} />
                ) : contacts.length < total ? (
                  <span className="text-xs text-text-secondary">
                    Showing <span className="font-medium text-text-primary">{contacts.length.toLocaleString()}</span> of <span className="font-medium text-text-primary">{total.toLocaleString()}</span> contacts — scroll down to load more
                  </span>
                ) : contacts.length > 0 ? (
                  <span className="text-xs text-text-secondary/60">All {total.toLocaleString()} contacts loaded</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Tag Manager slide-over panel */}
        {showTagManager && (
          <div className="w-72 border-l border-border-color bg-bg-primary flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-200">
            <TagManagerPanel
              groupId={activeGroupId}
              groupName={activeGroupId != null ? groups.find(g => g.id === activeGroupId)?.name : undefined}
              onClose={() => setShowTagManager(false)}
            />
          </div>
        )}

      </div>

      {/* ── Bulk action bar ──────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-bg-primary border-t border-border-color shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-2 flex-wrap">
            <span className="text-xs text-text-secondary">Priority:</span>
            {(['hot', 'high', 'medium', 'low'] as Priority[]).map(p => (
              <button
                key={p}
                onClick={() => handleBulkPriority(p)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${PRIORITY_COLORS[p]} hover:opacity-80`}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
            <div className="w-px h-4 bg-border-color mx-1" />

            {/* Add to group */}
            {groups.length > 0 && (
              <div className="relative" ref={bulkGroupRef}>
                <button
                  onClick={() => setShowBulkGroupPicker(o => !o)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-300 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  Add to Group
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showBulkGroupPicker && (
                  <div className="absolute bottom-full left-0 mb-1 z-50 bg-card-bg border border-border-color rounded-xl shadow-xl py-1.5 min-w-[180px]">
                    <p className="px-3 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Add {selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} to:</p>
                    {groups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleBulkAddToGroup(g.id)}
                        disabled={bulkAddingGroup === g.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color ?? '#6366f1' }} />
                        <span className="flex-1 truncate">{g.name}</span>
                        {bulkAddingGroup === g.id
                          ? <Loader2 className="w-3 h-3 animate-spin text-text-secondary flex-shrink-0" />
                          : <span className="text-[10px] text-text-secondary/60 flex-shrink-0">{g.member_count}</span>
                        }
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="w-px h-4 bg-border-color mx-1" />
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
          <button onClick={clearSelection} className="ml-auto text-text-secondary hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Modals / Drawers ─────────────────────────────────────── */}
      {/* Groups panel (fixed overlay) */}
      {showGroups && (
        <GroupRoutingPanel
          onClose={() => setShowGroups(false)}
          onGroupSelect={id => { applyGroupFilter(id); }}
          activeGroupId={activeGroupId}
        />
      )}

      <CreateContactModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditContact(null); }}
        editContact={editContact}
      />

      <ManageFieldsModal
        open={showFields}
        onClose={() => { setShowFields(false); loadFieldDefs(); }}
      />

      <ManageSourcesModal
        open={showSources}
        onClose={() => setShowSources(false)}
        onChanged={setSourceDefs}
      />

    </div>
  );
}

// ── Contact row ────────────────────────────────────────────────

function ContactRow({
  contact, selected, active, onToggle, deleting, onDelete, onOpen, onMessage, groups, onAddToGroup,
}: {
  contact: Contact;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
  deleting: boolean;
  onDelete: () => void;
  onOpen: () => void;
  onMessage: () => void;
  groups: ContactGroup[];
  onAddToGroup: (groupId: number) => Promise<void>;
}) {
  const initial = (contact.name ?? contact.phone ?? '?')[0]?.toUpperCase();
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [addingGroup, setAddingGroup] = useState<number | null>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showGroupMenu) return;
    const handler = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupMenu]);

  const handleAddToGroup = async (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    setAddingGroup(groupId);
    try {
      await onAddToGroup(groupId);
      setShowGroupMenu(false);
    } finally {
      setAddingGroup(null);
    }
  };

  return (
    <tr className={`group transition-colors cursor-pointer ${active ? 'bg-accent/8' : selected ? 'bg-accent/5' : 'hover:bg-bg-secondary/50'}`}
        onClick={onOpen}>
      {/* Checkbox */}
      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="rounded accent-accent" />
      </td>

      {/* Name + avatar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-semibold flex-shrink-0">
            {initial}
          </div>
          <div>
            <p className={`font-medium leading-tight transition-colors ${active ? 'text-accent' : 'text-text-primary group-hover:text-accent'}`}>
              {contact.name ?? <span className="text-text-secondary italic font-normal">No name</span>}
            </p>
            {contact.company && (
              <p className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                <Building2 className="w-3 h-3 flex-shrink-0" />
                {contact.company}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Phone + email */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          {contact.phone && (
            <span className="flex items-center gap-1.5 text-sm text-text-primary">
              <Phone className="w-3 h-3 text-text-secondary flex-shrink-0" />
              {contact.phone}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Mail className="w-3 h-3 flex-shrink-0" />
              {contact.email}
            </span>
          )}
        </div>
      </td>

      {/* Priority */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[contact.priority]}`}>
          {PRIORITY_LABELS[contact.priority]}
        </span>
      </td>

      {/* Routing */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ROUTING_COLORS[contact.routing_mode]}`}>
          {contact.routing_mode === 'ai' ? <Bot className="w-3 h-3" /> : contact.routing_mode === 'blocked' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
          {contact.routing_mode === 'ai' ? 'AI' : contact.routing_mode === 'manual' ? 'Manual' : 'Blocked'}
        </span>
      </td>

      {/* Tags — click to assign/remove */}
      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
        <TagPicker
          contactId={contact.id}
          assignedTags={contact.tags}
          trigger="pills"
        />
      </td>

      {/* Row actions */}
      <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {/* Open / start conversation */}
          <button
            onClick={e => { e.stopPropagation(); onMessage(); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 transition-all"
            title={contact.latest_conversation_id != null ? 'Open conversation' : 'Start conversation'}
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Add to group */}
          {groups.length > 0 && (
            <div className="relative" ref={groupMenuRef}>
              <button
                onClick={e => { e.stopPropagation(); setShowGroupMenu(o => !o); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-secondary hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                title="Add to group"
              >
                <FolderKanban className="w-4 h-4" />
              </button>
              {showGroupMenu && (
                <div className="absolute right-0 bottom-full mb-1 z-50 bg-card-bg border border-border-color rounded-xl shadow-xl py-1.5 min-w-[160px]">
                  <p className="px-3 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Add to group</p>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={e => handleAddToGroup(e, g.id)}
                      disabled={addingGroup === g.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color ?? '#6366f1' }} />
                      <span className="flex-1 truncate">{g.name}</span>
                      {addingGroup === g.id && <Loader2 className="w-3 h-3 animate-spin text-text-secondary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete */}
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
          ) : (
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-secondary hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Skeleton loader ────────────────────────────────────────────

function SkeletonCell({ w = 'w-24', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded-md bg-bg-secondary animate-pulse`} />;
}

function ContactTableSkeleton() {
  return (
    <table className="w-full text-sm border-collapse">
      <thead className="bg-bg-secondary border-b border-border-color sticky top-0 z-10">
        <tr>
          <th className="w-10 px-4 py-3"><div className="w-4 h-4 rounded bg-bg-secondary animate-pulse" /></th>
          {['Contact', 'Phone / Email', 'Priority', 'Routing', 'Tags', ''].map(h => (
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-color">
        {Array.from({ length: 12 }).map((_, i) => (
          <tr key={i} className="animate-pulse">
            {/* Checkbox */}
            <td className="px-4 py-3.5"><div className="w-4 h-4 rounded bg-bg-secondary" /></td>
            {/* Name + avatar */}
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-bg-secondary shrink-0" />
                <div className="space-y-1.5">
                  <div className={`h-3 rounded-md bg-bg-secondary ${i % 3 === 0 ? 'w-32' : i % 3 === 1 ? 'w-24' : 'w-28'}`} />
                  <div className={`h-2.5 rounded-md bg-bg-secondary/70 ${i % 2 === 0 ? 'w-20' : 'w-16'}`} />
                </div>
              </div>
            </td>
            {/* Phone / email */}
            <td className="px-4 py-3.5">
              <div className="space-y-1.5">
                <div className="w-28 h-3 rounded-md bg-bg-secondary" />
                <div className="w-36 h-2.5 rounded-md bg-bg-secondary/70" />
              </div>
            </td>
            {/* Priority badge */}
            <td className="px-4 py-3.5"><div className="w-14 h-5 rounded-full bg-bg-secondary" /></td>
            {/* Routing badge */}
            <td className="px-4 py-3.5"><div className="w-16 h-5 rounded-full bg-bg-secondary" /></td>
            {/* Tags */}
            <td className="px-4 py-3.5">
              <div className="flex gap-1">
                {i % 4 !== 0 && <div className={`h-4 rounded-md bg-bg-secondary ${i % 2 === 0 ? 'w-12' : 'w-16'}`} />}
                {i % 3 === 0 && <div className="h-4 w-10 rounded-md bg-bg-secondary" />}
              </div>
            </td>
            {/* Actions */}
            <td className="px-4 py-3.5"><div className="w-5 h-5 rounded bg-bg-secondary" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Load-more indicator ────────────────────────────────────────

function LoadMoreIndicator({ loaded, total }: { loaded: number; total: number }) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-2 py-2 w-full max-w-xs mx-auto">
      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Text */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
        <span>
          Loading more contacts…
          <span className="ml-1 text-text-secondary/60">{loaded.toLocaleString()} / {total.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────

function EmptyState({ onAdd, hasFilters, groupName }: { onAdd: () => void; hasFilters: boolean; groupName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-secondary px-8 text-center">
      {groupName ? <FolderKanban className="w-10 h-10 opacity-20" /> : <Users className="w-10 h-10 opacity-20" />}
      <p className="text-sm max-w-xs">
        {groupName
          ? <>The group <span className="font-medium text-text-primary">{groupName}</span> has no contacts yet. Select contacts from the list and use “Add to Group”.</>
          : hasFilters
          ? 'No contacts match the current filters. Try adjusting your search or filters.'
          : 'No contacts yet. Import from Excel or add one manually.'}
      </p>
      {!hasFilters && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 mt-1 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      )}
    </div>
  );
}
