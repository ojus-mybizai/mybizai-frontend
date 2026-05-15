'use client';

/**
 * Legacy re-export shim for old shared.tsx primitives.
 * New code should import directly from './design-system'.
 */

import React from 'react';
import type { ProcessEntry } from '@/services/processes';
import {
  Avatar as DSAvatar,
  Pill,
  PriorityDot,
  Money,
  formatCurrency as fc,
  formatNumber as fn,
  formatDate as fd,
  formatDateShort as fds,
  relativeTime as rt,
  STAGE_COLORS as SC,
  randomStageColor as rsc,
} from './design-system';

export const formatCurrency = fc;
export const formatNumber   = fn;
export const formatDate     = fd;
export const formatDateShort= fds;
export const relativeTime   = rt;
export const STAGE_COLORS   = SC;
export const randomStageColor = rsc;

export function sumValue(entries: ProcessEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.expected_value || 0), 0);
}

// Back-compat wrappers — same API as the old shared.tsx primitives, now powered
// by the new design system.

export function Avatar({ name, size = 'sm' }: { name?: string | null; size?: 'xs' | 'sm' | 'md' }) {
  return <DSAvatar name={name} size={size} />;
}

export function PriorityBadge({ priority }: { priority: 'low' | 'medium' | 'high' | null | undefined }) {
  if (!priority) return null;
  const tone = priority === 'high' ? 'danger' : priority === 'medium' ? 'warn' : 'neutral';
  return (
    <Pill tone={tone} size="xs" icon={<PriorityDot priority={priority} />}>
      {priority}
    </Pill>
  );
}

export function ValueBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return <Money value={value} compact size="sm" tone="success" />;
}

export function SlaChip({
  status, days,
}: {
  status: 'ok' | 'warn' | 'breach' | null | undefined;
  days: number | null | undefined;
}) {
  if (days === null || days === undefined) return null;
  const tone = status === 'breach' ? 'danger' : status === 'warn' ? 'warn' : 'neutral';
  return <Pill tone={tone} size="xs">{days}d</Pill>;
}

export function CloseDateChip({ iso }: { iso: string | null }) {
  if (!iso) return null;
  const date = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const tone = diff < 0 ? 'danger' : diff <= 7 ? 'warn' : 'neutral';
  const label = diff < 0 ? `${Math.abs(diff)}d ago`
    : diff === 0 ? 'today'
    : diff <= 7 ? `${diff}d`
    : formatDateShort(iso);
  return <Pill tone={tone} size="xs">{label}</Pill>;
}
