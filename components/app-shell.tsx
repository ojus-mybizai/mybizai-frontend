'use client';

import { ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { performLogout } from '@/lib/auth-actions';
import { useThemeStore } from '@/lib/theme-store';
import { useAgentStore } from '@/lib/agent-store';

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
  label: string;
  href: string;
  short: string;
  children?: NavChild[];
}

type NavSection = {
  kind: 'section';
  label: string;
};

type NavEntry = NavItem | NavSection;

function isNavItem(entry: NavEntry): entry is NavItem {
  return typeof (entry as NavItem | undefined)?.href === 'string';
}

function buildNavItems(lmsEnabled: boolean, agentsEnabled: boolean): NavEntry[] {
  const items: NavEntry[] = [
    { kind: 'section', label: 'Foundation' },
    { label: 'Dashboard', href: '/dashboard', short: 'DB' },
    { label: 'Data Sheet', href: '/data-sheet', short: 'DS' },
    { label: 'Catalog & Stock', href: '/catalog', short: 'CT' },
    { label: 'Orders & Bookings', href: '/orders', short: 'OR' },
    { label: 'Reports', href: '/reports', short: 'RP' },
    { label: 'Settings', href: '/settings', short: 'ST' },
  ];

  if (lmsEnabled) {
    items.push({ label: 'Customers', href: '/customers', short: 'CU' });
    items.push({ label: 'Conversations', href: '/conversations', short: 'CV' });
    items.push({ label: 'Channels', href: '/channels', short: 'CH' });
    items.push({ label: 'Work & Tasks', href: '/work', short: 'WK' });
    items.push({ label: 'Employees', href: '/employees', short: 'EM' });
  }

  items.push({ kind: 'section', label: 'Purchased Modules' });
  items.push({ label: 'Storefront', href: '/storefront/settings', short: 'SF' });

  if (agentsEnabled) {
    items.push({
      label: 'Business Agents',
      href: '/agents',
      short: 'BA',
      children: [
        { label: 'All Agents', href: '/agents', group: 'manage' },
        { label: 'New Agent', href: '/agents/new', group: 'manage' },
        { label: 'Last Opened Agent', href: '/agents', group: 'workspace', isLastAgent: true },
        { label: 'Lead Templates', href: '/lead-templates', group: 'analytics' },
        { label: 'Agent Analytics', href: '/analytics', group: 'analytics' },
        { label: 'Message Templates', href: '/agents/templates', group: 'analytics' },
      ],
    });
  }

  return items;
}

function getTitle(pathname: string | null, navItems: NavEntry[]): string {
  if (!pathname) return 'MyBizAI';
  const items = navItems.filter(isNavItem);
  const match = items.find((entry) => {
    if (entry.href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(entry.href);
  });
  return match ? match.label : 'MyBizAI';
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user as any);
  const business = user?.businesses?.[0];
  const lmsEnabled = business?.lms_enabled !== false;
  const agentsEnabled = business?.agents_enabled !== false;
  const navItems = buildNavItems(lmsEnabled, agentsEnabled);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNavHref, setOpenNavHref] = useState<string | null>(
    pathname && pathname.startsWith('/agents') ? '/agents' : null,
  );
  const theme = useThemeStore((s) => s.theme);
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

  const isActive = (item: NavItem) => {
    if (!pathname) return false;
    if (item.href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(item.href);
  };

  const title = getTitle(pathname, navItems);

  const SidebarContent = (
    <div className="flex h-full flex-col border-r border-border-color bg-bg-primary">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border-color">
        <div className="inline-flex items-center gap-2 rounded-full border border-border-color bg-bg-secondary px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            MyBizAI
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map((entry) => {
          if (!isNavItem(entry)) {
            return (
              <div
                key={`section-${entry.label}`}
                className="mt-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary"
              >
                {entry.label}
              </div>
            );
          }

          const item = entry;
          const active = isActive(item);
          const isAgents = item.href === '/agents';
          const isOpen = !!item.children && openNavHref === item.href;

          const handleAgentSubClick = (child: NavChild) => {
            if (child.isLastAgent) {
              if (lastAgentId) {
                handleNavigate(`/agents/${lastAgentId}/overview`);
              } else {
                handleNavigate('/agents');
              }
            } else {
              handleNavigate(child.href);
            }
          };

          return (
            <div key={item.href} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (item.children && item.href === '/agents') {
                    setOpenNavHref(isOpen ? null : item.href);
                    handleNavigate(item.href);
                  } else {
                    setOpenNavHref(null);
                    handleNavigate(item.href);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-left transition-colors ${
                  active
                    ? 'bg-card-bg text-text-primary'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border-color bg-bg-secondary text-xs font-semibold text-text-secondary">
                    {item.short}
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.children && (
                  <span className="text-xs text-text-secondary">
                    {isOpen ? '▾' : '▸'}
                  </span>
                )}
              </button>

              {isAgents && item.children && isOpen && (
                <div className="ml-8 mt-1 space-y-0.5 border-l border-border-color pl-3 text-xs">
                  {item.children.map((child) => {
                    const childActive =
                      pathname === child.href ||
                      (child.isLastAgent && pathname.startsWith('/agents/'));
                    const isDisabledLast = child.isLastAgent && !lastAgentId;
                    const label =
                      child.isLastAgent && !lastAgentId
                        ? 'Last Opened Agent (none yet)'
                        : child.label;
                    return (
                      <button
                        key={child.label}
                        type="button"
                        onClick={() => handleAgentSubClick(child)}
                        disabled={isDisabledLast}
                        title={
                          child.isLastAgent && !lastAgentId
                            ? 'Open an agent to pin it here.'
                            : undefined
                        }
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors ${
                          childActive
                            ? 'bg-card-bg text-text-primary font-semibold'
                            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                        } ${isDisabledLast ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border-color px-2 py-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-left text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border-color bg-bg-secondary text-xs font-semibold text-text-secondary">
            LO
          </div>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-bg-secondary text-text-primary flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block md:w-56 lg:w-64">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64 max-w-[80vw] bg-bg-primary border-r border-border-color">
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

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="h-14 border-b border-border-color bg-bg-primary px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:text-text-primary md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              Menu
            </button>
            <h1 className="text-sm font-semibold text-text-primary md:text-base truncate max-w-[50vw] md:max-w-none">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-secondary max-w-[40vw] md:max-w-xs truncate">
            <button
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              className="inline-flex items-center gap-1 rounded-full border border-border-color bg-bg-secondary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-accent-soft hover:text-text-primary transition-colors"
            >
              <span className="text-xs" aria-hidden="true">
                {theme === 'dark' ? '🌙' : '☀️'}
              </span>
              <span className="hidden sm:inline">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </button>
            {user && (
              <span className="truncate">
                {user.email || user.username || 'Account'}
              </span>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 px-2 md:px-3 py-4 md:py-5 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
