'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  Target,
  Briefcase,
  ClipboardList,
  UserCog,
  Bot,
  LogOut,
  Settings,
  MessagesSquare,
  BarChart2,
  Home,
  CheckSquare,
  CreditCard,
  MapPin,
  Phone,
  TrendingUp,
  Clipboard,
  List,
  UserPlus,
  DollarSign,
  Package,
  Calendar,
  BookOpen,
  Radio,
  Zap,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { performLogout } from '@/lib/auth-actions';
import { useThemeStore } from '@/lib/theme-store';
import { useAgentStore } from '@/lib/agent-store';
import { useTourStore } from '@/lib/tour-store';
import { DataSheetNav } from '@/components/data-sheet-nav';
import NotificationBell from '@/components/notifications/notification-bell';
import { TourOverlay } from '@/components/tour/tour-overlay';
import { OnboardingChecklist } from '@/components/tour/onboarding-checklist';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AppShellProps {
  children: ReactNode;
}

interface NavChild {
  label: string;
  href: string;
  group?: 'manage' | 'workspace' | 'analytics';
  isLastAgent?: boolean;
}

interface NavItem {
  kind?: never;
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
}

type NavSection = { kind: 'section'; label: string };
type DataSheetSlot = { kind: 'datasheet' };
type NavEntry = NavItem | NavSection | DataSheetSlot;

function isNavItem(e: NavEntry): e is NavItem {
  return !('kind' in e) || e.kind === undefined;
}
function isSection(e: NavEntry): e is NavSection {
  return (e as NavSection).kind === 'section';
}
function isDataSheetSlot(e: NavEntry): e is DataSheetSlot {
  return (e as DataSheetSlot).kind === 'datasheet';
}

/* ─── Nav builder ────────────────────────────────────────────────────────── */

function buildNavItems(
  lmsEnabled: boolean,
  agentsEnabled: boolean,
  hasPermission: (key: string) => boolean,
): NavEntry[] {
  const items: NavEntry[] = [];

  // ── Dashboard (always, no section header) ────────────────────────────────
  items.push({ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard });
  if (hasPermission('manage_settings')) {
    items.push({ label: 'Business Builder', href: '/builder', icon: Sparkles });
  }

  // ── Work (daily employee flow) ────────────────────────────────────────────
  if (lmsEnabled) {
    items.push({ kind: 'section', label: 'Work' });
    items.push({ label: 'My Workstation', href: '/employee-dashboard', icon: Briefcase });
    items.push({ label: 'Workstation',    href: '/workstation',        icon: CheckSquare });
    if (hasPermission('manage_work')) {
      items.push({ label: 'Work & Tasks',   href: '/work',               icon: ClipboardList });
      items.push({ label: 'Processes',      href: '/processes',          icon: ClipboardList });
    }
    items.push({ label: 'Team Chats',     href: '/chats',              icon: MessagesSquare });
    items.push({ label: 'AI Assistants',   href: '/agent-chat',         icon: Bot });
  }

  // ── CRM (customer-facing) ─────────────────────────────────────────────────
  if (lmsEnabled) {
    items.push({ kind: 'section', label: 'CRM' });
    if (hasPermission('manage_leads')) {
      items.push({ label: 'Leads',          href: '/leads',          icon: Users });
    }
    items.push({ label: 'Conversations', href: '/conversations', icon: MessageSquare });
    if (hasPermission('manage_channels')) {
      items.push({ label: 'Lead Sources',  href: '/lead-sources',  icon: Target });
    }
  }

  // ── Data & Insights ───────────────────────────────────────────────────────
  items.push({ kind: 'section', label: 'Data & Insights' });
  items.push({ kind: 'datasheet' }); // DataSheetNav dropdown renders here
  if (hasPermission('view_reports')) {
    items.push({ label: 'Reports', href: '/reports', icon: BarChart2 });
  }

  // ── People ────────────────────────────────────────────────────────────────
  if (lmsEnabled && hasPermission('manage_employees')) {
    items.push({ kind: 'section', label: 'People' });
    items.push({ label: 'Employees', href: '/employees', icon: UserCog });
  }

  // ── Automation ────────────────────────────────────────────────────────────
  if (lmsEnabled && hasPermission('manage_settings')) {
    items.push({ label: 'Automation', href: '/automation', icon: Zap });
  }

  // ── Modules ───────────────────────────────────────────────────────────────
  if (agentsEnabled && hasPermission('manage_agents')) {
    items.push({ kind: 'section', label: 'Modules' });
    items.push({
      label: 'AI Agents',
      href: '/agents',
      icon: Bot,
      children: [
        { label: 'All Agents',          href: '/agents',            group: 'manage' },
        { label: 'New Agent',           href: '/agents/new',        group: 'manage' },
        { label: 'Last Opened Agent',   href: '/agents',            group: 'workspace', isLastAgent: true },
        { label: 'Lead Templates',      href: '/lead-templates',    group: 'analytics' },
        { label: 'Agent Analytics',     href: '/analytics',         group: 'analytics' },
        { label: 'Message Templates',   href: '/agents/templates',  group: 'analytics' },
      ],
    });
  }

  return items;
}

/* ─── Icon resolver for blueprint nav ───────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'dashboard': LayoutDashboard,
  'users': Users,
  'user-plus': UserPlus,
  'user-cog': UserCog,
  'message-square': MessageSquare,
  'messages-square': MessagesSquare,
  'target': Target,
  'briefcase': Briefcase,
  'clipboard-list': ClipboardList,
  'clipboard': Clipboard,
  'list': List,
  'file-text': FileText,
  'bar-chart-2': BarChart2,
  'bot': Bot,
  'settings': Settings,
  'home': Home,
  'check-square': CheckSquare,
  'credit-card': CreditCard,
  'map-pin': MapPin,
  'phone': Phone,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  'package': Package,
  'calendar': Calendar,
  'book-open': BookOpen,
  'radio': Radio,
  'zap': Zap,
};

function resolveIcon(iconName?: string): LucideIcon {
  if (!iconName) return FileText;
  return ICON_MAP[iconName] || FileText;
}

/* ─── Builtin target → URL mapping ──────────────────────────────────────── */

const BUILTIN_TARGETS: Record<string, string> = {
  dashboard: '/dashboard',
  leads: '/leads',
  customers: '/leads',
  conversations: '/conversations',
  workstation: '/employee-dashboard',
  work: '/work',
  employees: '/employees',
  chats: '/chats',
  reports: '/reports',
  settings: '/settings',
  'lead-sources': '/lead-sources',
  agents: '/agents',
  automation: '/automation',
};

/* ─── Build nav from navigation_config ──────────────────────────────────── */

interface NavConfigGroup {
  group: string;
  icon?: string;
  items: Array<{
    label: string;
    type: string;
    target?: string;
    url?: string;
    icon?: string;
    permission?: string;
    filter?: string;
  }>;
}

function buildCustomNavItems(
  navConfig: NavConfigGroup[],
  hasPermission: (key: string) => boolean,
  agentsEnabled: boolean,
): NavEntry[] {
  const items: NavEntry[] = [];

  // Always show dashboard first
  items.push({ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard });

  for (const group of navConfig) {
    const groupItems: NavEntry[] = [];

    for (const item of group.items) {
      // Check permission
      if (item.permission && !hasPermission(item.permission)) continue;

      let href: string;
      const icon = resolveIcon(item.icon);

      // If url is directly provided, use it
      if (item.url) {
        href = item.url;
      } else {
        switch (item.type) {
          case 'builtin':
            href = BUILTIN_TARGETS[item.target ?? ''] || `/${item.target ?? ''}`;
            break;
          case 'datasheet':
            href = `/data-sheet/${item.target}`;
            break;
          case 'work_template':
            href = `/work?template=${item.target}`;
            break;
          case 'agent_conversations':
            href = `/conversations?agent=${encodeURIComponent(item.target ?? '')}`;
            break;
          case 'internal_agent':
            href = `/agent-chat/${encodeURIComponent(item.target ?? '')}`;
            break;
          default:
            href = `/${item.target || ''}`;
        }
      }

      groupItems.push({ label: item.label, href, icon });
    }

    if (groupItems.length > 0) {
      items.push({ kind: 'section', label: group.group });
      items.push(...groupItems);
    }
  }

  // Always add Data & Insights section with DataSheet dropdown for advanced users
  items.push({ kind: 'section', label: 'Data & Insights' });
  items.push({ kind: 'datasheet' });
  if (hasPermission('view_reports')) {
    items.push({ label: 'Reports', href: '/reports', icon: BarChart2 });
  }

  // Automation
  if (hasPermission('manage_settings')) {
    items.push({ label: 'Automation', href: '/automation', icon: Zap });
  }

  // Always add Modules section if agents enabled
  if (agentsEnabled && hasPermission('manage_agents')) {
    items.push({ kind: 'section', label: 'Modules' });
    items.push({
      label: 'AI Agents',
      href: '/agents',
      icon: Bot,
      children: [
        { label: 'All Agents',          href: '/agents',            group: 'manage' },
        { label: 'New Agent',           href: '/agents/new',        group: 'manage' },
        { label: 'Last Opened Agent',   href: '/agents',            group: 'workspace', isLastAgent: true },
        { label: 'Lead Templates',      href: '/lead-templates',    group: 'analytics' },
        { label: 'Agent Analytics',     href: '/analytics',         group: 'analytics' },
        { label: 'Message Templates',   href: '/agents/templates',  group: 'analytics' },
      ],
    });
  }

  return items;
}

/* ─── Page title resolver ────────────────────────────────────────────────── */

const TITLE_MAP: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/employee-dashboard': 'My Workstation',
  '/work':               'Work & Tasks',
  '/chats':              'Team Chats',
  '/agent-chat':         'AI Assistants',
  '/leads':              'Leads',
  '/conversations':      'Conversations',
  '/lead-sources':       'Lead Sources',
  '/data-sheet':         'Data Sheet',
  '/reports':            'Reports',
  '/employees':          'Employees',
  '/agents':             'AI Agents',
  '/lead-templates':     'Lead Templates',
  '/analytics':          'Agent Analytics',
  '/settings':           'Settings',
  '/automation':         'Automation',
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

/* ─── AppShell ───────────────────────────────────────────────────────────── */

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user as any);
  const business = user?.businesses?.[0];
  const lmsEnabled  = business?.lms_enabled  !== false;
  const agentsEnabled = business?.agents_enabled !== false;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const navConfig = business?.extra_data?.navigation_config as NavConfigGroup[] | undefined;
  const navItems = navConfig && navConfig.length > 0
    ? buildCustomNavItems(navConfig, hasPermission, agentsEnabled)
    : buildNavItems(lmsEnabled, agentsEnabled, hasPermission);

  const isInitialized = useAuthStore((s) => s.isInitialized);
  // Only check loading AFTER mount to avoid SSR/client hydration mismatch
  // During SSR and first client render, always show skeleton (consistent on both sides)

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNavHref, setOpenNavHref] = useState<string | null>(
    pathname?.startsWith('/agents') ? '/agents' : null,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const navLoading = !mounted || !isInitialized || !user;
  const theme     = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const lastAgentId = useAgentStore((s) => s.lastAgentId);

  const handleNavigate = (href: string) => {
    setSidebarOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    await performLogout();
    setSidebarOpen(false);
    router.replace('/login');
  };

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const title = getTitle(pathname);

  // User avatar initials
  const userDisplay = user?.name || user?.email || '';
  const initials = userDisplay
    ? userDisplay.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
    : '?';

  /* ── Sidebar nav item render ─────────────────────────────────────────── */
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const isAgents = item.href === '/agents';
    const isOpen = !!item.children && openNavHref === item.href;

    const handleAgentSubClick = (child: NavChild) => {
      if (child.isLastAgent) {
        handleNavigate(lastAgentId ? `/agents/${lastAgentId}/overview` : '/agents');
      } else {
        handleNavigate(child.href);
      }
    };

    // Generate a data-tour attribute from the href for the tour system
    const tourId = item.href.replace(/^\//, '').replace(/\//g, '-') || 'home';

    return (
      <div key={item.href || item.label}>
        <button
          type="button"
          data-tour={`nav-${tourId}`}
          onClick={() => {
            if (isAgents && item.children) {
              setOpenNavHref(isOpen ? null : item.href);
              handleNavigate(item.href);
            } else {
              setOpenNavHref(null);
              handleNavigate(item.href);
            }
          }}
          className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-left transition-all ${
            active
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <item.icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
              }`}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
          </div>
          {item.children && (
            <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''} ${active ? 'text-accent' : 'text-text-secondary'}`}>
              ▸
            </span>
          )}
        </button>

        {/* Agent submenu */}
        {isAgents && item.children && isOpen && (
          <div className="ml-6 mt-0.5 border-l border-border-color pl-3 space-y-0.5">
            {item.children.map((child) => {
              const childActive =
                pathname === child.href ||
                (child.isLastAgent && !!pathname?.startsWith('/agents/'));
              const disabled = child.isLastAgent && !lastAgentId;
              return (
                <button
                  key={child.label}
                  type="button"
                  onClick={() => handleAgentSubClick(child)}
                  disabled={disabled}
                  title={disabled ? 'Open an agent to pin it here.' : undefined}
                  className={`flex w-full items-center rounded-md px-2 py-2 text-xs text-left transition-colors ${
                    childActive
                      ? 'text-accent font-semibold'
                      : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="truncate">
                    {child.isLastAgent && !lastAgentId ? 'Last Opened (none yet)' : child.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── Sidebar content ─────────────────────────────────────────────────── */
  const SidebarContent = (
    <div className="flex h-full flex-col bg-bg-primary border-r border-border-color">

      {/* Brand header */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-4 border-b border-border-color">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
          <span className="text-xs font-bold text-white leading-none">M</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate leading-tight">MyBizAI</p>
          {business?.name && (
            <p className="text-[11px] text-text-secondary truncate leading-tight">{business.name}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navLoading ? (
          /* Sidebar skeleton while auth/user data loads */
          <div className="space-y-1 py-1">
            {[1, 2].map((section) => (
              <div key={section}>
                <div className={`${section > 1 ? 'mt-4' : 'mt-1'} mb-2 ml-1`}>
                  <div className="h-2.5 w-14 animate-pulse rounded bg-bg-secondary" />
                </div>
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                    <div className="h-4 w-4 animate-pulse rounded bg-bg-secondary shrink-0" />
                    <div className={`h-3 animate-pulse rounded bg-bg-secondary ${item === 1 ? 'w-20' : item === 2 ? 'w-24' : 'w-16'}`} />
                  </div>
                ))}
              </div>
            ))}
            <div className="mt-4 mb-2 ml-1">
              <div className="h-2.5 w-16 animate-pulse rounded bg-bg-secondary" />
            </div>
            {[1, 2, 3, 4].map((item) => (
              <div key={`c-${item}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                <div className="h-4 w-4 animate-pulse rounded bg-bg-secondary shrink-0" />
                <div className={`h-3 animate-pulse rounded bg-bg-secondary ${item % 2 === 0 ? 'w-24' : 'w-20'}`} />
              </div>
            ))}
          </div>
        ) : (
          <>
          {navItems.map((entry, idx) => {
            // Section divider
            if (isSection(entry)) {
              return (
                <div key={`s-${entry.label}`} className={`${idx > 0 ? 'mt-4' : 'mt-2'} mb-1 flex items-center gap-2`}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary/60 whitespace-nowrap">
                    {entry.label}
                  </span>
                  <div className="h-px flex-1 bg-border-color/60" />
                </div>
              );
            }

            // DataSheetNav slot
            if (isDataSheetSlot(entry)) {
              return (
                <DataSheetNav key="datasheet" onNavigate={() => setSidebarOpen(false)} />
              );
            }

            // Regular nav item
            return renderNavItem(entry);
          })}
          </>
        )}
      </nav>

      {/* Footer — user info + settings/logout */}
      <div className="shrink-0 border-t border-border-color">
        {/* User identity row */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary leading-tight">
              {user?.name || user?.email?.split('@')[0] || 'Account'}
            </p>
            {user?.email && user?.name && (
              <p className="truncate text-[10px] text-text-secondary leading-tight">{user.email}</p>
            )}
          </div>
        </div>
        {/* Action row */}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border-color py-1.5 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          >
            <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="hidden lg:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              useTourStore.getState().toggleChecklist();
            }}
            title="Tour & Onboarding"
            className="flex items-center justify-center rounded-md border border-border-color p-1.5 text-text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <span className="text-sm" aria-hidden>🎓</span>
          </button>
          <button
            type="button"
            onClick={() => { setSidebarOpen(false); router.push('/settings'); }}
            title="Settings"
            className="flex items-center justify-center rounded-md border border-border-color p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="flex items-center justify-center rounded-md border border-border-color p-1.5 text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Shell layout ────────────────────────────────────────────────────── */
  return (
    <div className="h-screen overflow-hidden bg-bg-secondary text-text-primary flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:block md:w-52 lg:w-60 shrink-0">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-60 max-w-[80vw] bg-bg-primary border-r border-border-color overflow-hidden">
            {SidebarContent}
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
        <header className="h-14 shrink-0 border-b border-border-color bg-bg-primary px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle */}
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
            <h1 className="text-sm font-semibold text-text-primary truncate">{title}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle — desktop only (also in sidebar) */}
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-full border border-border-color bg-bg-secondary px-3 text-xs font-medium text-text-secondary hover:bg-accent-soft hover:text-text-primary transition-colors"
            >
              <span aria-hidden>{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            {/* Notification bell */}
            <NotificationBell />
            {user && (
              <span className="hidden sm:block text-xs text-text-secondary max-w-[160px] truncate">
                {user.email || user.username || ''}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          key={pathname}
          className={`${mounted ? 'animate-page-in' : ''} ${
            pathname?.startsWith('/conversations') || pathname?.startsWith('/chats') || pathname === '/dashboard'
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3'
              : pathname?.match(/^\/data-sheet\/[^/]+(\/)?$/)
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-2 md:px-3 py-4 md:py-5'
                : 'min-h-0 flex-1 overflow-y-auto px-2 md:px-3 py-4 md:py-5'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Tour overlay + onboarding checklist */}
      <TourOverlay />
      <OnboardingChecklist />
    </div>
  );
}
