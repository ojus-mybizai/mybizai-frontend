'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Legacy reseller-managed flags (`agents`, `lms`) still apply for backwards
 * compat — they are NOT part of the plan-driven module catalog. Plan modules
 * use the snake_case keys from backend/app/billing/module_catalog.py.
 */
type LegacyModule = 'agents' | 'lms';
type ModuleKey = LegacyModule | string;

interface Props {
  /**
   * Module key. Legacy values `agents` and `lms` are reseller-managed boolean
   * flags on Business; any other string is looked up in the plan's active_modules.
   */
  module?: ModuleKey;
  /** Alias for `module` — older pages used `moduleKey`. */
  moduleKey?: ModuleKey;
  children: ReactNode;
}

const MODULE_LABELS: Record<string, string> = {
  agents: 'Business Agents',
  lms: 'Lead Management System',
  chat_agent: 'AI Chat Agent',
  multi_channel: 'Multi-Channel Messaging',
  crm: 'CRM',
  contacts: 'CRM',
  data_sheets: 'Data Sheets',
  knowledge_base: 'Knowledge Base',
  follow_up: 'Follow-Up Automation',
  nurture: 'Nurture Sequences',
  storefront: 'Public Storefront',
  payments: 'Payment Links',
  campaigns: 'Outbound Campaigns',
  wa_employees: 'WhatsApp Employees',
  work_tasks: 'Work & Tasks',
  agent_builder: 'Agent Builder',
  mcp_server: 'MCP Server',
};

/**
 * Page-level module key → backend module catalog key. Lets existing pages keep
 * their semantic prop name (e.g. moduleKey="contacts") while the backend uses
 * the canonical `crm` module slug.
 */
const MODULE_ALIAS: Record<string, string> = {
  contacts: 'crm',
};

export default function ModuleGuard({ module, moduleKey, children }: Props) {
  const raw = (module || moduleKey || 'base') as ModuleKey;
  const resolved = MODULE_ALIAS[raw] || raw;

  const user = useAuthStore((s) => s.user as { businesses?: Array<Record<string, unknown>> } | null);
  const activeModules = useAuthStore((s) => s.activeModules);
  const hasModule = useAuthStore((s) => s.hasModule);
  const business = user?.businesses?.[0];

  let allowed = true;
  let copy = 'This module is not enabled for your plan.';

  if (resolved === 'agents') {
    allowed = business?.agents_enabled !== false;
    copy = 'Business Agents is an add-on. Contact your reseller to enable.';
  } else if (resolved === 'lms') {
    allowed = business?.lms_enabled !== false;
    copy = 'Lead Management System is not enabled. Contact your reseller.';
  } else if (!activeModules || activeModules.length === 0) {
    // Auth state not fully hydrated yet (e.g. user logged in before active_modules
    // started shipping in /users/me, or page rendered before bootstrap finished).
    // Don't show the lock screen — server-side guards will still block any
    // forbidden mutations, and a refresh will pick up the real module list.
    allowed = true;
  } else {
    allowed = hasModule(resolved);
    copy = `This feature isn't included in your current plan. Upgrade to unlock ${MODULE_LABELS[raw] || MODULE_LABELS[resolved] || resolved}.`;
  }

  if (allowed) return <>{children}</>;

  const moduleLabel = MODULE_LABELS[resolved] || resolved;
  const isLegacy = resolved === 'agents' || resolved === 'lms';
  const upgradeLink = isLegacy ? '/home' : '/settings/billing';
  const ctaLabel = isLegacy ? 'Back to Dashboard' : 'View plans';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full rounded-lg border border-border-color bg-card-bg p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border-color bg-bg-secondary text-2xl text-text-secondary">
          🔒
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">{moduleLabel} is locked</h2>
        <p className="text-sm text-text-secondary mb-6">{copy}</p>
        <Link
          href={upgradeLink}
          className="inline-flex items-center justify-center rounded-md border border-border-color bg-accent-soft px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent hover:text-white transition-colors"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
