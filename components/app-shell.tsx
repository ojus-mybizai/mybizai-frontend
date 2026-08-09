'use client';

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Bot,
  Radio,
  Megaphone,
  Zap,
  UserCheck,
  MessageCircle,
  FileText,
  LogOut,
  Settings,
  CreditCard,
  Coins,
  UsersRound,
  Users,
  Filter,
  Repeat,
  Workflow,
  Boxes,
  Briefcase,
  Send,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  MousePointer2,
  Database,
  GraduationCap,
  SlidersHorizontal,
  Plug,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { performLogout } from '@/lib/auth-actions';
import { useThemeStore } from '@/lib/theme-store';
import { useTourStore } from '@/lib/tour-store';
import { useUIStore } from '@/lib/ui-store';
import { DataSheetNav } from '@/components/data-sheet-nav';
import { SystemNav } from '@/components/system-nav';
import NotificationBell from '@/components/notifications/notification-bell';
import { GlobalSearch } from '@/components/global-search';
import { TourOverlay } from '@/components/tour/tour-overlay';
import { OnboardingChecklist } from '@/components/tour/onboarding-checklist';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  kind?: never;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Module key from active_modules; hides item if module not active. */
  module?: string;
}

interface NavGroup {
  kind: 'group';
  label: string;
  href: string;
  icon: LucideIcon;
  children: NavItem[];
  /** Module key from active_modules; hides whole group if module not active. */
  module?: string;
}

/**
 * ConfigGroup — the collapsible "Configure" tier. Behaves like a NavGroup but
 * its open/closed state is persisted app-wide via ui-store (not the transient
 * per-render openGroups set), so setup-time surfaces stay folded away for
 * veterans and expanded for new users on demand. `href` is only used as the
 * collapsed-rail degrade target.
 */
interface ConfigGroup {
  kind: 'configgroup';
  label: string;
  href: string;
  icon: LucideIcon;
  children: NavItem[];
}

type NavSection    = { kind: 'section'; label: string };
type DataSheetSlot = { kind: 'datasheet' };
type SystemsSlot   = { kind: 'systems' };
type NavEntry      = NavItem | NavGroup | ConfigGroup | NavSection | DataSheetSlot | SystemsSlot;

function isNavGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).kind === 'group';
}
function isConfigGroup(e: NavEntry): e is ConfigGroup {
  return (e as ConfigGroup).kind === 'configgroup';
}
function isSection(e: NavEntry): e is NavSection {
  return (e as NavSection).kind === 'section';
}
function isDataSheetSlot(e: NavEntry): e is DataSheetSlot {
  return (e as DataSheetSlot).kind === 'datasheet';
}
function isSystemsSlot(e: NavEntry): e is SystemsSlot {
  return (e as SystemsSlot).kind === 'systems';
}

/**
 * Filter nav entries by active modules:
 *  - Drop items/groups whose `module` is not in activeModules.
 *  - Collapse "orphan" sections: if a section header is followed only by removed
 *    items (or nothing) before the next section, drop the header too.
 *
 * If `activeModules` is empty (e.g. unauth/SSR), pass everything through —
 * we don't want the sidebar to flash empty on initial render.
 */
function filterNavByModules(entries: NavEntry[], activeModules: string[]): NavEntry[] {
  if (!activeModules || activeModules.length === 0) return entries;
  const has = (m?: string) => !m || activeModules.includes(m);

  // First pass: drop hidden items. Config-group children are filtered in place;
  // a group left with no children is dropped entirely.
  const kept: NavEntry[] = [];
  for (const e of entries) {
    if (isSection(e) || isDataSheetSlot(e) || isSystemsSlot(e)) { kept.push(e); continue; }
    if (isConfigGroup(e)) {
      const children = e.children.filter((c) => has(c.module));
      if (children.length) kept.push({ ...e, children });
      continue;
    }
    if (isNavGroup(e)) { if (has(e.module)) kept.push(e); continue; }
    if (has(e.module)) kept.push(e);
  }

  // Second pass: drop section headers with no item between them and the next section
  const out: NavEntry[] = [];
  for (let i = 0; i < kept.length; i++) {
    const e = kept[i];
    if (isSection(e)) {
      let j = i + 1;
      let hasContent = false;
      while (j < kept.length && !isSection(kept[j])) {
        if (!isSection(kept[j])) { hasContent = true; break; }
        j++;
      }
      if (!hasContent) continue;
    }
    out.push(e);
  }
  return out;
}

/* ─── Nav definitions ────────────────────────────────────────────────────── */

/**
 * Owner nav — three intent tiers instead of six feature buckets:
 *
 *   1. Workspace    — the handful of screens opened every day.
 *   2. Your Systems — one expandable group per business System (its datasheets,
 *                     pipeline, agent, dashboard together); driven by <SystemNav>.
 *   3. Configure    — setup-time surfaces (channels, templates, agents, memory,
 *                     automation, work config, account) folded behind one
 *                     collapsible group so they stop competing for attention.
 *
 * `module` still hides an item when its module isn't active.
 */
const OWNER_NAV: NavEntry[] = [
  { kind: 'section', label: 'Workspace' },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Inbox',     href: '/inbox',     icon: MessageSquare },
  { label: 'Contacts',  href: '/contacts',  icon: UserCheck, module: 'crm' },
  { label: 'Tasks',     href: '/wa-work',    icon: Send,      module: 'work_tasks' },

  { kind: 'section', label: 'Your Systems' },
  { kind: 'systems' },

  // ── Setup & configuration — collapsed by default (persisted) ─────────────
  {
    kind: 'configgroup',
    label: 'Configure',
    href: '/settings',            // collapsed-rail degrade target
    icon: SlidersHorizontal,
    children: [
      { label: 'Campaigns',       href: '/campaigns',         icon: Megaphone,      module: 'campaigns' },
      { label: 'Channels',        href: '/channels',          icon: Radio },
      { label: 'Integrations',    href: '/integrations/meta', icon: Plug },
      { label: 'Msg Templates',   href: '/message-templates', icon: MessageCircle },
      { label: 'Agents',          href: '/agents',            icon: Bot,            module: 'chat_agent' },
      { label: 'Internal Chat',   href: '/internal-chat',     icon: MessagesSquare, module: 'chat_agent' },
      { label: 'Memory',          href: '/memory',            icon: Database,       module: 'chat_agent' },
      { label: 'Automation',      href: '/automation',        icon: Zap,            module: 'follow_up' },
      { label: 'Work Templates',  href: '/wa-templates',      icon: FileText,       module: 'work_tasks' },
      { label: 'Work Board',      href: '/work',              icon: Briefcase,      module: 'work_tasks' },
      { label: 'Processes',       href: '/processes',         icon: Workflow,       module: 'work_tasks' },
      { label: 'Members',         href: '/members',           icon: UsersRound },
      { label: 'Tasks',           href: '/tasks',             icon: ListChecks },
      { label: 'Roles & Access',  href: '/settings?tab=roles', icon: Users },
      { label: 'WhatsApp Settings', href: '/settings/whatsapp', icon: MessageCircle, module: 'wa_employees' },
      { label: 'Settings',        href: '/settings',          icon: Settings },
      { label: 'Billing',         href: '/settings/billing',  icon: CreditCard },
      { label: 'AI Credits',      href: '/settings/credits',  icon: Coins },
    ],
  },
];

/** Simplified nav for team members / employees */
const EMPLOYEE_NAV: NavEntry[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },

  { kind: 'section', label: 'Work' },
  { label: 'Inbox',     href: '/inbox',     icon: MessageSquare },
  { label: 'Work',      href: '/work',      icon: Briefcase },
  { label: 'Contacts',  href: '/contacts',  icon: UserCheck },
  { label: 'Processes', href: '/processes', icon: Workflow },

  { kind: 'section', label: 'Data Sheets' },
  { kind: 'datasheet' },

  { kind: 'section', label: 'Account' },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/* ─── Page title resolver ────────────────────────────────────────────────── */

const TITLE_MAP: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/dashboard/chat':      'Assistant',
  '/contacts':            'Contacts',
  '/contacts/import':     'Import Contacts',
  '/inbox':               'Inbox',
  '/campaigns':           'Campaigns',
  '/campaigns/new':       'New Campaign',
  '/message-templates':   'Message Templates',
  '/wa-templates':        'Work Templates',
  '/wa-templates/new':    'New Work Template',
  '/channels':            'Channels',
  '/systems':             'Systems',
  '/systems/builder':     'System Builder',
  '/agents':              'Agents',
  '/internal-chat':       'Internal Chat',
  '/memory':              'Memory',
  '/agent-chat':          'AI Chat',
  '/automation':          'Automation',
  '/wa-work':             'Tasks',           // WhatsApp task dispatch (primary task system)
  '/members':             'Members',         // Unified identity surface (Phase 4)
  '/tasks':               'Tasks',           // Unified task surface over task_assignments (Phase 4, Slice 3)
  '/work':                'Work Board',      // Platform internal kanban
  '/work/templates':      'Work Templates',
  '/processes':           'Processes',
  '/data-sheet':          'Data Sheets',
  '/settings':            'Settings',
  '/settings/whatsapp':   'WhatsApp Settings',
  '/settings/billing':    'Billing & Plans',
  '/integrations/meta':   'Meta Ads',
  '/analytics':           'Analytics',
};

function getTitle(pathname: string | null): string {
  if (!pathname) return 'MyBizAI';
  const exact = TITLE_MAP[pathname];
  if (exact) return exact;
  for (const [prefix, label] of Object.entries(TITLE_MAP)) {
    if (pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) return label;
  }
  return 'MyBizAI';
}

/* Routes that should always start with a collapsed sidebar (info-dense screens). */
const FORCE_COLLAPSED_ROUTES = ['/inbox'];

function isForceCollapsedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return FORCE_COLLAPSED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

/* ─── AppShell ───────────────────────────────────────────────────────────── */

export default function AppShell({ children }: AppShellProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user as any);
  const isOwner  = useAuthStore((s) => s.isOwner);
  const activeModules = useAuthStore((s) => s.activeModules);
  const business = user?.businesses?.[0];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [openGroups,  setOpenGroups]  = useState<Set<string>>(new Set());

  /* Sidebar collapse / hover-expand state (persisted via UIController) */
  const sidebarMode        = useUIStore((s) => s.sidebarMode);
  const hoverExpandEnabled = useUIStore((s) => s.hoverExpandEnabled);
  const isHoverExpanded    = useUIStore((s) => s.isHoverExpanded);
  const setHoverExpanded   = useUIStore((s) => s.setHoverExpanded);
  const toggleSidebar      = useUIStore((s) => s.toggleSidebar);
  const setSidebarMode     = useUIStore((s) => s.setSidebarMode);
  const setHoverExpandPref = useUIStore((s) => s.setHoverExpandEnabled);
  const uiHydrated         = useUIStore((s) => s.hydrated);
  const configOpen         = useUIStore((s) => s.configOpen);
  const toggleConfig       = useUIStore((s) => s.toggleConfig);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  /* Force-collapse on info-dense routes; restore on leave. We track this in a
     ref so the user can still toggle while on the route (their toggle wins
     until they navigate to a different route).                                */
  const lastForceCollapsedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!uiHydrated) return;
    const forceCollapsed = isForceCollapsedRoute(pathname);
    if (forceCollapsed && !lastForceCollapsedRef.current) {
      // entering a force-collapsed route — collapse if not already
      if (sidebarMode !== 'collapsed') setSidebarMode('collapsed');
    }
    lastForceCollapsedRef.current = forceCollapsed;
    // We deliberately do NOT depend on sidebarMode here so user toggles during
    // the route aren't fought by this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, uiHydrated]);

  // Defer nav selection until after mount so SSR output (no auth state) matches
  // the client's initial render. Zustand restores isOwner from localStorage
  // synchronously, causing a server/client mismatch without this guard.
  const _RAW_NAV = mounted ? (isOwner ? OWNER_NAV : EMPLOYEE_NAV) : EMPLOYEE_NAV;
  const NAV_ITEMS = mounted ? filterNavByModules(_RAW_NAV, activeModules) : _RAW_NAV;

  /* Auto-open any group whose child matches the current pathname */
  useEffect(() => {
    if (!pathname) return;
    const toOpen: string[] = [];
    for (const entry of NAV_ITEMS) {
      if (isNavGroup(entry)) {
        if (entry.children.some((c) => pathname.startsWith(c.href))) {
          toOpen.push(entry.href);
        }
      }
    }
    if (toOpen.length) {
      setOpenGroups((prev) => new Set([...prev, ...toOpen]));
    }
  }, [pathname, isOwner]);

  const theme       = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const handleNavigate = (href: string) => {
    setSidebarOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    await performLogout();
    setSidebarOpen(false);
    router.replace('/login');
  };

  const toggleGroup = useCallback((href: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href); else next.add(href);
      return next;
    });
  }, []);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname?.startsWith('/dashboard') ?? false;
    if (href === '/campaigns')     return pathname === '/campaigns' || pathname.startsWith('/campaigns/');
    if (href === '/settings')      return pathname === '/settings';
    return pathname.startsWith(href);
  };

  const title = getTitle(pathname);

  const userDisplay = user?.name || user?.email || '';
  const initials = userDisplay
    ? userDisplay.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
    : '?';

  /* Effective visual mode = pinned mode unless collapsed-and-being-hovered    */
  const isCollapsed       = sidebarMode === 'collapsed';
  const isVisuallyExpanded = !isCollapsed || isHoverExpanded;

  const onSidebarEnter = useCallback(() => {
    if (!isCollapsed || !hoverExpandEnabled) return;
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setHoverExpanded(true);
  }, [isCollapsed, hoverExpandEnabled, setHoverExpanded]);

  const onSidebarLeave = useCallback(() => {
    if (!isCollapsed) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // small grace period so users cursoring across to content don't snap shut mid-click
    hoverTimerRef.current = setTimeout(() => setHoverExpanded(false), 220);
  }, [isCollapsed, setHoverExpanded]);

  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);
  // Cancel hover-expand whenever the user pins the sidebar open.
  useEffect(() => { if (!isCollapsed) setHoverExpanded(false); }, [isCollapsed, setHoverExpanded]);

  /* ── Flat nav item ───────────────────────────────────────────────────── */
  const renderNavItem = (item: NavItem, compact = false, expanded = true) => {
    const active = isActive(item.href);
    const tourId = item.href.replace(/^\//, '').replace(/\//g, '-') || 'home';
    return (
      <button
        key={item.href}
        type="button"
        data-tour={`nav-${tourId}`}
        onClick={() => handleNavigate(item.href)}
        title={!expanded ? item.label : undefined}
        aria-label={!expanded ? item.label : undefined}
        className={`group flex w-full items-center rounded-lg text-left transition-all
          ${expanded
            ? (compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-2 text-sm')
            : 'h-9 justify-center px-0'}
          ${active
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          }`}
      >
        <item.icon
          className={`shrink-0 transition-colors
            ${expanded ? 'mr-2' : ''}
            ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
            ${active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
          aria-hidden
        />
        {expanded && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  /* ── Collapsible group ───────────────────────────────────────────────── */
  const renderNavGroup = (group: NavGroup, expanded: boolean) => {
    // When the sidebar is collapsed, a group degrades to its parent icon —
    // children become inaccessible until the user hover-expands or pins open.
    if (!expanded) {
      return renderNavItem(
        { label: group.label, href: group.href, icon: group.icon } as NavItem,
        false,
        false,
      );
    }

    const isOpen      = openGroups.has(group.href);
    const parentMatch = isActive(group.href);
    const childMatch  = group.children.some((c) => pathname?.startsWith(c.href));
    const highlighted = parentMatch || childMatch;

    return (
      <div key={group.href}>
        <button
          type="button"
          onClick={() => {
            handleNavigate(group.href);
            toggleGroup(group.href);
          }}
          className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left transition-all
            ${highlighted
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
            }`}
        >
          <group.icon
            className={`h-4 w-4 shrink-0 mr-2.5 transition-colors
              ${highlighted ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
            aria-hidden
          />
          <span className="flex-1 truncate">{group.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200
              ${isOpen ? 'rotate-180' : ''}
              ${highlighted ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
            aria-hidden
          />
        </button>

        {isOpen && (
          <div className="mt-0.5 ml-[11px] border-l border-border-color pl-3 pb-0.5 space-y-0.5">
            {group.children.map((child) => renderNavItem(child, true, true))}
          </div>
        )}
      </div>
    );
  };

  /* ── Configure group (persisted open state via ui-store) ─────────────── */
  const renderConfigGroup = (group: ConfigGroup, expanded: boolean) => {
    const childMatch = group.children.some((c) => isActive(c.href));

    // Collapsed rail: degrade to a single icon that routes to the group's
    // representative page; highlight when the current page lives inside it.
    if (!expanded) {
      const active = childMatch;
      return (
        <button
          key="configgroup"
          type="button"
          onClick={() => handleNavigate(group.href)}
          title={group.label}
          aria-label={group.label}
          className={`group flex h-9 w-full items-center justify-center rounded-lg transition-all
            ${active ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
        >
          <group.icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`} aria-hidden />
        </button>
      );
    }

    return (
      <div key="configgroup">
        <button
          type="button"
          onClick={toggleConfig}
          aria-expanded={configOpen}
          className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-left transition-all
            ${childMatch && !configOpen
              ? 'text-accent font-medium'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
        >
          <group.icon
            className={`h-4 w-4 shrink-0 mr-2.5 transition-colors
              ${childMatch && !configOpen ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`}
            aria-hidden
          />
          <span className="flex-1 truncate">{group.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-text-secondary
              ${configOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {configOpen && (
          <div className="mt-0.5 ml-[11px] border-l border-border-color pl-3 pb-0.5 space-y-0.5">
            {group.children.map((child) => renderNavItem(child, true, true))}
          </div>
        )}
      </div>
    );
  };

  /* ── Section header / divider ────────────────────────────────────────── */
  const renderSection = (label: string, key: string, expanded: boolean) => {
    if (expanded) {
      return (
        <div
          key={key}
          className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/70"
        >
          {label}
        </div>
      );
    }
    return <div key={key} className="my-1.5 mx-2 border-t border-border-color" aria-hidden />;
  };

  /* ── Sidebar content ─────────────────────────────────────────────────── */
  const renderSidebarContent = (expanded: boolean) => (
    <div className="flex h-full flex-col bg-bg-primary border-r border-border-color">

      {/* Brand header + collapse toggle */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border-color ${
          expanded ? 'gap-3 px-3' : 'flex-col gap-1 py-2 px-2'
        }`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
          <span className="text-xs font-bold text-white leading-none">M</span>
        </div>
        {expanded && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate leading-tight">MyBizAI</p>
            {business?.name && (
              <p className="text-[11px] text-text-secondary truncate leading-tight">{business.name}</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
          className={`shrink-0 inline-flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors ${
            expanded ? 'h-7 w-7' : 'h-6 w-6'
          }`}
        >
          {isCollapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
            : <PanelLeftClose className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-2 space-y-0.5 ${expanded ? 'px-2' : 'px-1.5'}`}>
        {NAV_ITEMS.map((entry, idx) => {
          if (isDataSheetSlot(entry)) {
            if (expanded) {
              return <DataSheetNav key="datasheet" onNavigate={() => setSidebarOpen(false)} />;
            }
            // Collapsed: degrade to a single icon button that navigates to /data-sheet
            return renderNavItem(
              { label: 'Data Sheets', href: '/data-sheet', icon: Database } as NavItem,
              false,
              false,
            );
          }
          if (isSystemsSlot(entry)) {
            if (expanded) {
              return <SystemNav key="systems" onNavigate={() => setSidebarOpen(false)} />;
            }
            // Collapsed: degrade to a single icon button → the systems overview.
            return renderNavItem(
              { label: 'Your Systems', href: '/systems', icon: Boxes } as NavItem,
              false,
              false,
            );
          }
          if (isSection(entry))         return renderSection(entry.label, `section-${idx}`, expanded);
          if (isConfigGroup(entry))     return renderConfigGroup(entry, expanded);
          if (isNavGroup(entry))        return renderNavGroup(entry, expanded);
          return renderNavItem(entry, false, expanded);
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border-color">
        {/* User info — full row when expanded, avatar-only when collapsed */}
        <div className={`flex items-center ${expanded ? 'gap-2.5 px-3 py-3' : 'justify-center py-2.5'}`}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold"
            title={!expanded ? (user?.name || user?.email || 'Account') : undefined}
          >
            {initials}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary leading-tight">
                {user?.name || user?.email?.split('@')[0] || 'Account'}
              </p>
              <p className="text-[10px] leading-tight mt-0.5" suppressHydrationWarning>
                {mounted && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${
                    isOwner ? 'bg-accent/10 text-accent' : 'bg-bg-secondary text-text-secondary'
                  }`}>
                    {isOwner ? 'Owner' : 'Team Member'}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Action row */}
        {expanded ? (
          <div className="flex items-center gap-1 px-2 pb-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border-color py-1.5 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
            >
              <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            <button
              type="button"
              onClick={() => setHoverExpandPref(!hoverExpandEnabled)}
              title={hoverExpandEnabled ? 'Disable hover-expand' : 'Enable hover-expand (sidebar grows when you hover it)'}
              aria-pressed={hoverExpandEnabled}
              className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border transition-colors ${
                hoverExpandEnabled
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border-color text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => { setSidebarOpen(false); useTourStore.getState().toggleChecklist(); }}
              title="Tour & Onboarding"
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-border-color text-text-secondary hover:bg-accent/10 hover:text-accent transition-colors"
            >
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-border-color text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 pb-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
            >
              <span aria-hidden>{theme === 'dark' ? '🌙' : '☀️'}</span>
            </button>
            <button
              type="button"
              onClick={() => setHoverExpandPref(!hoverExpandEnabled)}
              title={hoverExpandEnabled ? 'Hover-expand: on (click to disable)' : 'Hover-expand: off (click to enable)'}
              aria-pressed={hoverExpandEnabled}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                hoverExpandEnabled
                  ? 'text-accent bg-accent/10'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              }`}
            >
              <MousePointer2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => { setSidebarOpen(false); useTourStore.getState().toggleChecklist(); }}
              title="Tour & Onboarding"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-accent/10 hover:text-accent transition-colors"
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Shell layout ────────────────────────────────────────────────────── */
  // Pre-render mobile drawer always expanded; desktop respects collapsed state.
  const desktopAsideWidth = isCollapsed ? 'md:w-14' : 'md:w-52 lg:w-60';
  const showHoverOverlay  = isCollapsed && isHoverExpanded;

  return (
    <div className="h-screen overflow-hidden bg-bg-secondary text-text-primary flex">

      {/* Desktop sidebar — reserves the collapsed footprint; hover-expand floats over content */}
      <aside
        className={`hidden md:block shrink-0 relative ${desktopAsideWidth} transition-[width] duration-200`}
        onMouseEnter={onSidebarEnter}
        onMouseLeave={onSidebarLeave}
      >
        {/* Pinned sidebar — always renders so layout is stable */}
        <div className="h-full">
          {renderSidebarContent(!isCollapsed)}
        </div>

        {/* Hover-expanded overlay — sits on top of the collapsed rail and over the page */}
        {showHoverOverlay && (
          <div
            className="absolute inset-y-0 left-0 z-30 w-60 shadow-2xl ring-1 ring-black/5 animate-in fade-in slide-in-from-left-2 duration-150"
            onMouseEnter={onSidebarEnter}
            onMouseLeave={onSidebarLeave}
          >
            {renderSidebarContent(true)}
          </div>
        )}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-60 max-w-[80vw] bg-bg-primary border-r border-border-color overflow-hidden">
            {renderSidebarContent(true)}
          </div>
          <button
            type="button"
            aria-label="Close sidebar"
            className="flex-1 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">

        {/* Topbar */}
        <header className="h-14 shrink-0 border-b border-border-color bg-bg-primary px-4 md:px-6 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-color bg-bg-secondary text-text-secondary hover:text-text-primary md:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold text-text-primary truncate hidden sm:block">{title}</h1>
          </div>

          <div className="flex-1 flex justify-center">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main
          key={pathname}
          className={`${mounted ? 'animate-page-in' : ''} ${
            // Full-bleed app panels: manage their own scroll + header, no shell padding
            pathname?.startsWith('/inbox') || pathname?.startsWith('/dashboard') || pathname?.startsWith('/wa-work') || pathname?.startsWith('/internal-chat') || pathname === '/contacts'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : pathname?.match(/^\/data-sheet\/[^/]+(\/)?$/)
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-2 md:px-3 py-4 md:py-5'
                // Self-padded scrolling pages (their own container sets the gutter): no shell padding
                : pathname?.startsWith('/processes/') || pathname?.match(/^\/contacts\/\d+/)
                  ? 'min-h-0 flex-1 overflow-y-auto'
                  // Default document pages: keep breathing room so headers don't touch the banner
                  : 'min-h-0 flex-1 overflow-y-auto px-2 md:px-3 py-4 md:py-5'
          }`}
        >
          {children}
        </main>
      </div>

      <TourOverlay />
      <OnboardingChecklist />
    </div>
  );
}
