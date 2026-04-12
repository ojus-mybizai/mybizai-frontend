/**
 * Dynamic Tour Generator
 *
 * Reads an applied template's JSON and generates:
 * 1. Tour steps — interactive walkthrough of highlighted UI elements
 * 2. Checklist items — persistent onboarding tracker
 *
 * Different templates produce different tours (Clinic ≠ E-commerce).
 */

import type { TourStep, ChecklistItem } from './tour-store';
import type { BlueprintJSON } from '@/services/blueprint';

// ── Industry-specific welcome messages ────────────────────────────

const WELCOME_MESSAGES: Record<string, { title: string; desc: string }> = {
  healthcare: {
    title: 'Welcome to your Clinic! 🏥',
    desc: 'Your clinic management system is ready. Let\'s walk through the key features that were set up for you.',
  },
  real_estate: {
    title: 'Welcome to your Real Estate Hub! 🏠',
    desc: 'Your property management system is ready. Let\'s explore what was created for you.',
  },
  ecommerce: {
    title: 'Welcome to your Online Store! 🛒',
    desc: 'Your e-commerce management system is ready. Let\'s see what you can do.',
  },
  restaurant: {
    title: 'Welcome to your Restaurant Manager! 🍽️',
    desc: 'Your restaurant management system is set up. Let\'s take a quick tour.',
  },
};

const DEFAULT_WELCOME = {
  title: 'Your business is set up! ✨',
  desc: 'Everything has been configured. Let\'s walk through the key features.',
};

// ── Generator ─────────────────────────────────────────────────────

export function generateTourFromTemplate(
  slug: string,
  data: BlueprintJSON
): { tourSteps: TourStep[]; checklist: ChecklistItem[] } {
  const industry = (data.industry as string) || '';
  const name = (data.name as string) || 'Your Business';
  const welcome = WELCOME_MESSAGES[industry] || DEFAULT_WELCOME;

  const datasheets = (data.datasheets as any[]) || [];
  const agents = (data.agents as any[]) || [];
  const automations = (data.automations as any[]) || [];
  const roles = (data.roles as any[]) || [];
  const pipelines = (data.pipeline_stages as any[]) || [];
  const processes = (data.processes as any[]) || [];
  const kbEntries = (data.knowledge_base as any[]) || [];
  const workTemplates = (data.work_templates as any[]) || [];

  const tourSteps: TourStep[] = [];
  const checklist: ChecklistItem[] = [];

  // ── Step 1: Welcome (centered, no target) ──────────────────

  tourSteps.push({
    id: 'welcome',
    title: welcome.title,
    description: welcome.desc,
    targetSelector: '',
    placement: 'center',
  });

  // ── Step 2: Dashboard overview ─────────────────────────────

  tourSteps.push({
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'This is your command center. View metrics, recent activity, and manage your AI conversations all from here.',
    targetSelector: '[data-tour="nav-dashboard"]',
    placement: 'right',
  });

  // ── Step 3: Datasheets ─────────────────────────────────────

  if (datasheets.length > 0) {
    const parentSheets = datasheets.filter((d: any) => d.display_name);
    const childCount = datasheets.reduce(
      (sum: number, d: any) => sum + (d.children?.length || 0), 0
    );
    const primarySheet = parentSheets[0];

    tourSteps.push({
      id: 'datasheets',
      title: 'Your Data Sheets',
      description: `We created ${datasheets.length} datasheet${datasheets.length > 1 ? 's' : ''}${childCount > 0 ? ` with ${childCount} nested sub-table${childCount > 1 ? 's' : ''}` : ''} for you. ${primarySheet ? `"${primarySheet.display_name}" is your main database.` : ''} Click to explore your data.`,
      targetSelector: '[data-tour="nav-datasheets"]',
      placement: 'right',
    });

    checklist.push({
      id: 'explore-datasheets',
      title: 'Explore your datasheets',
      description: `Open ${primarySheet?.display_name || 'your datasheets'} and browse the fields`,
      href: '/data-sheet',
      icon: 'database',
    });

    checklist.push({
      id: 'add-first-record',
      title: 'Add your first record',
      description: `Create a record in ${primarySheet?.display_name || 'your datasheet'}`,
      href: '/data-sheet',
      icon: 'plus-circle',
    });
  }

  // ── Step 4: CRM / Leads ────────────────────────────────────

  if (pipelines.length > 0) {
    tourSteps.push({
      id: 'leads',
      title: 'Lead Management',
      description: `Your lead pipeline has ${pipelines.length} stages: ${pipelines.map((s: any) => s.name).slice(0, 3).join(' → ')}${pipelines.length > 3 ? ' → …' : ''}. Track every inquiry from first contact to conversion.`,
      targetSelector: '[data-tour="nav-leads"]',
      placement: 'right',
    });

    checklist.push({
      id: 'view-pipeline',
      title: 'View your lead pipeline',
      description: 'See how leads flow through your stages',
      href: '/leads',
      icon: 'funnel',
    });
  }

  // ── Step 5: AI Agents ──────────────────────────────────────

  if (agents.length > 0) {
    const agent = agents[0];
    const skillCount = agent.skills?.length || 0;

    tourSteps.push({
      id: 'agents',
      title: `Meet ${agent.name} 🤖`,
      description: `Your AI agent "${agent.name}" is ready to help! It has ${skillCount} skills and can ${agent.role_type === 'SALES' ? 'capture leads and answer sales questions' : 'answer questions, capture leads, and assist customers'}. Deploy it to WhatsApp, Instagram, or your website.`,
      targetSelector: '[data-tour="nav-agents"]',
      placement: 'right',
    });

    checklist.push({
      id: 'try-agent',
      title: `Chat with ${agent.name}`,
      description: 'Test your AI agent in a conversation',
      href: '/agents',
      icon: 'bot',
    });

    checklist.push({
      id: 'deploy-channel',
      title: 'Connect a channel',
      description: 'Deploy your agent to WhatsApp, Instagram, or web',
      href: '/channels',
      icon: 'message-circle',
    });
  }

  // ── Step 6: Automation ─────────────────────────────────────

  if (automations.length > 0) {
    tourSteps.push({
      id: 'automations',
      title: 'Automations',
      description: `${automations.length} automation rule${automations.length > 1 ? 's' : ''} ${automations.length > 1 ? 'were' : 'was'} created. These run automatically when events happen — like notifying you when a new inquiry arrives, or creating a follow-up task.`,
      targetSelector: '[data-tour="nav-automation"]',
      placement: 'right',
    });

    checklist.push({
      id: 'view-automations',
      title: 'Review your automations',
      description: `${automations.length} rule${automations.length > 1 ? 's' : ''} are running`,
      href: '/automation',
      icon: 'zap',
    });
  }

  // ── Step 7: Work & Tasks ───────────────────────────────────

  if (workTemplates.length > 0 || processes.length > 0) {
    tourSteps.push({
      id: 'work',
      title: 'Work & Task Management',
      description: `${workTemplates.length} work template${workTemplates.length !== 1 ? 's' : ''} are ready to use. ${processes.length > 0 ? `Plus ${processes.length} business process${processes.length !== 1 ? 'es' : ''} with automated stage workflows.` : 'Assign tasks to your team and track progress.'}`,
      targetSelector: '[data-tour="nav-work"]',
      placement: 'right',
    });

    checklist.push({
      id: 'explore-work',
      title: 'Explore work templates',
      description: 'See the pre-built task templates',
      href: '/work',
      icon: 'clipboard-list',
    });
  }

  // ── Step 8: Team / Employees ───────────────────────────────

  if (roles.length > 0) {
    tourSteps.push({
      id: 'team',
      title: 'Your Team Roles',
      description: `${roles.length} role${roles.length !== 1 ? 's' : ''} ${roles.length !== 1 ? 'were' : 'was'} created: ${roles.map((r: any) => r.name).join(', ')}. Invite team members and assign them roles with the right permissions.`,
      targetSelector: '[data-tour="nav-employees"]',
      placement: 'right',
    });

    checklist.push({
      id: 'invite-team',
      title: 'Invite your team',
      description: `Assign ${roles.map((r: any) => r.name).join(', ')} roles`,
      href: '/employees',
      icon: 'users',
    });
  }

  // ── Step 9: Finish ─────────────────────────────────────────

  tourSteps.push({
    id: 'finish',
    title: 'You\'re all set! 🎉',
    description: 'Your business is configured and ready to go. Use the checklist in the bottom-right corner to track your progress as you explore each feature.',
    targetSelector: '',
    placement: 'center',
  });

  // ── Pre-completed checklist item ───────────────────────────

  checklist.unshift({
    id: 'apply-template',
    title: 'Apply business template',
    description: `${name} template applied`,
    href: '/setup/templates',
    icon: 'layout-template',
    preCompleted: true,
  });

  return { tourSteps, checklist };
}
