/**
 * Credits API client — balance, packs catalog, Razorpay top-up.
 *
 * Top-up flow:
 *   1. listCreditPacks() → show pack picker
 *   2. createTopupOrder(slug) → returns Razorpay order_id + key_id
 *   3. Open Razorpay checkout (script loaded on demand) with that order_id
 *   4. On successful payment, Razorpay sends webhook → backend grants credits
 *   5. Client should refetch balance after a short delay (or refresh on close)
 */
import { apiFetch } from '@/lib/api-client';

export interface CreditBalance {
  balance_credits: number;
  lifetime_granted: number;
  lifetime_consumed: number;
  monthly_cap?: number | null;
  current_month_used: number;
  current_month_period?: string | null;
  credits_expire_at?: string | null;
}

export interface CreditPack {
  slug: string;
  name: string;
  credits: number;
  bonus_credits: number;
  total_credits: number;
  price_inr: number;
  per_credit_inr: number;
  tagline: string;
  display_order: number;
}

export interface CreditTopupCheckout {
  topup_id: number;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_inr: number;
  amount_paise: number;
  currency: string;
  pack: CreditPack;
  business_id: number;
  business_name?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

export interface CreditTopupHistory {
  id: number;
  pack_slug: string;
  credits: number;
  bonus_credits: number;
  price_inr: number;
  status: 'created' | 'paid' | 'failed' | 'granted' | 'refunded';
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  paid_at?: string | null;
  granted_at?: string | null;
}

export interface CreditLedgerEntry {
  id: number;
  entry_type: 'grant' | 'debit' | 'refund' | 'expiry' | 'adjustment';
  credits_delta: number;
  balance_after: number;
  source: string;
  reference_type?: string | null;
  reference_id?: number | null;
  description?: string | null;
  created_at: string;
}

export async function getCreditBalance(): Promise<CreditBalance> {
  return apiFetch<CreditBalance>('/credits/balance', { method: 'GET' });
}

export async function listCreditPacks(): Promise<CreditPack[]> {
  return apiFetch<CreditPack[]>('/credits/packs', { method: 'GET' });
}

export async function createTopupOrder(packSlug: string): Promise<CreditTopupCheckout> {
  return apiFetch<CreditTopupCheckout>('/credits/topup', {
    method: 'POST',
    body: JSON.stringify({ pack_slug: packSlug }),
  });
}

export async function listTopupHistory(limit = 20): Promise<CreditTopupHistory[]> {
  return apiFetch<CreditTopupHistory[]>(`/credits/topup/history?limit=${limit}`, { method: 'GET' });
}

export async function listCreditLedger(opts?: {
  entry_type?: CreditLedgerEntry['entry_type'];
  source?: string;
  limit?: number;
}): Promise<CreditLedgerEntry[]> {
  const p = new URLSearchParams();
  if (opts?.entry_type) p.set('entry_type', opts.entry_type);
  if (opts?.source) p.set('source', opts.source);
  if (opts?.limit) p.set('limit', String(opts.limit));
  const qs = p.toString();
  return apiFetch<CreditLedgerEntry[]>(`/credits/ledger${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

// ─── Razorpay checkout helper ───────────────────────────────────────────────
// Razorpay window type is declared in app/(protected)/settings/credits/page.tsx

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.getElementById('razorpay-checkout-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay checkout for a credit pack purchase.
 * Returns a promise that resolves with the Razorpay response on success,
 * rejects on dismissal/failure.
 */
export async function openRazorpayCheckout(
  checkout: CreditTopupCheckout,
  options?: { onSuccess?: (resp: any) => void; onDismiss?: () => void },
): Promise<any> {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Failed to load Razorpay checkout script');
  if (!window.Razorpay) throw new Error('Razorpay script loaded but global not available');

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rzp = new (window.Razorpay as any)({
      key: checkout.razorpay_key_id,
      amount: checkout.amount_paise,
      currency: checkout.currency,
      order_id: checkout.razorpay_order_id,
      name: 'MyBizAI',
      description: `${checkout.pack.name} — ${checkout.pack.total_credits.toLocaleString()} credits`,
      prefill: {
        name: checkout.user_name ?? '',
        email: checkout.user_email ?? '',
      },
      notes: {
        business_id: String(checkout.business_id),
        pack_slug: checkout.pack.slug,
      },
      theme: { color: '#4F46E5' },
      handler: (response: any) => {
        options?.onSuccess?.(response);
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          options?.onDismiss?.();
          reject(new Error('Payment cancelled by user'));
        },
      },
    });
    rzp.open();
  });
}
