/**
 * P5 — Onboarding Conductor API client. Mirrors services/internal-chat.ts'
 * shape (one fn per endpoint, no raw fetch/inline URLs) but targets the
 * ungated `/onboarding/*` routes — the one surface allowed to call while
 * Business.onboarding_completed is still false.
 */
import { apiFetch } from '@/lib/api-client';
import type { Callback, MessageOut, SendResponse } from '@/lib/agent-blocks';

const BASE = '/onboarding';

export interface OnboardingStatus {
  onboarding_completed: boolean;
  session_status: 'in_progress' | 'gate_satisfied' | 'completed' | string;
  conversation_id: number;
  plan: string[];
  step_statuses: Record<string, { status: string; conversation_id?: number }>;
  /** True once every built-in specialist is applied or skipped (wrap-up time). */
  specialists_complete: boolean;
}

/** Resolves/creates this business's OnboardingSession + conductor conversation. */
export function getStatus(): Promise<OnboardingStatus> {
  return apiFetch<OnboardingStatus>(`${BASE}/status`, { method: 'GET' });
}

/**
 * Full transcript of the conductor thread (resume scrollback). NOTE: this route
 * has a side-effect — it bootstraps the conductor's opening turn when the thread
 * is empty. Use it once for that; render from `getTranscript()`.
 */
export function getMessages(): Promise<MessageOut[]> {
  return apiFetch<MessageOut[]>(`${BASE}/messages`, { method: 'GET' });
}

/**
 * Phase 0 merged read model: ONE ordered, agent-labeled stream across the
 * conductor thread + every specialist sub-thread. Pure read (no bootstrap).
 */
export function getTranscript(): Promise<MessageOut[]> {
  return apiFetch<MessageOut[]>(`${BASE}/transcript`, { method: 'GET' });
}

/** One turn with the conductor. Same shape as internal-chat's send. */
export function sendMessage(
  body: { message: string } | { callback: Callback },
): Promise<SendResponse> {
  return apiFetch<SendResponse>(`${BASE}/message`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
