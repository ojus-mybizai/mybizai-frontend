'use client';

import { MessageCircle } from 'lucide-react';

/**
 * WhatsApp 24-hour session-window pill.
 *
 * Meta only lets a business send free-form messages within 24 hours of the
 * customer's (here: the team member's) last inbound message. Outside that
 * window every send has to be a Meta-approved template — the composer branches
 * on this same signal. Surfacing it on every member row means owners know
 * whether their next message will land instantly or need a template first.
 *
 * States:
 *   open     — >4h left. Green.
 *   closing  — ≤4h left. Amber.
 *   closed   — window elapsed or never opened. Red.
 *   none     — no WhatsApp number attached. Silent (returns null).
 */
export type WindowState = 'open' | 'closing' | 'closed' | 'none';

const CLOSING_THRESHOLD_MS = 4 * 60 * 60 * 1000;

export function classifyWindow(
  expiresAt: string | null | undefined,
  active: boolean | undefined,
  hasWhatsapp: boolean,
): WindowState {
  if (!hasWhatsapp) return 'none';
  if (!expiresAt) return 'closed';
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0 || !active) return 'closed';
  if (remainingMs <= CLOSING_THRESHOLD_MS) return 'closing';
  return 'open';
}

function shortLabel(expiresAt: string | null | undefined, state: WindowState): string {
  if (state === 'closed') return 'closed';
  if (!expiresAt) return '—';
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remainingMs / (60 * 60 * 1000)));
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));
  return `${minutes}m`;
}

const STYLE: Record<Exclude<WindowState, 'none'>, string> = {
  open:    'bg-green-100/70 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  closing: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  closed:  'bg-red-100/70 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const TITLE: Record<Exclude<WindowState, 'none'>, (label: string) => string> = {
  open:    (l) => `WhatsApp session open — ~${l} left to send free-form messages.`,
  closing: (l) => `WhatsApp session closing — only ~${l} left. After that, only templates will send.`,
  closed:  () => `WhatsApp 24-hour session closed. Free-form messages will not deliver — send an approved template to reopen the window.`,
};

export function SessionWindowChip({
  expiresAt,
  active,
  hasWhatsapp,
  size = 'sm',
  showIcon = false,
}: {
  expiresAt: string | null | undefined;
  active: boolean | undefined;
  hasWhatsapp: boolean;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}) {
  const state = classifyWindow(expiresAt, active, hasWhatsapp);
  if (state === 'none') return null;

  const label = shortLabel(expiresAt, state);
  const sizeCls = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-mono font-medium tabular-nums ${sizeCls} ${STYLE[state]}`}
      title={TITLE[state](label)}
    >
      {showIcon && <MessageCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
