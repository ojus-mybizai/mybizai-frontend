'use client';
/**
 * TopupModal — pick a credit pack, open Razorpay, refresh balance on success.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   ...
 *   {open && <TopupModal onClose={() => setOpen(false)} onPurchased={refetch} />}
 */
import { useEffect, useState } from 'react';
import {
  listCreditPacks,
  createTopupOrder,
  openRazorpayCheckout,
  type CreditPack,
} from '@/services/credits';

interface Props {
  onClose: () => void;
  onPurchased?: () => void;
}

export default function TopupModal({ onClose, onPurchased }: Props) {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCreditPacks()
      .then(setPacks)
      .catch((e) => setError(e?.message || 'Failed to load packs'))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (pack: CreditPack) => {
    setError(null);
    setBuying(pack.slug);
    try {
      const checkout = await createTopupOrder(pack.slug);
      await openRazorpayCheckout(checkout, {
        onSuccess: () => {
          // Webhook will arrive asynchronously to grant credits.
          // Wait a beat, then refresh.
          setTimeout(() => { onPurchased?.(); onClose(); }, 1500);
        },
        onDismiss: () => setBuying(null),
      });
    } catch (e: any) {
      if (e?.message !== 'Payment cancelled by user') {
        setError(e?.message || 'Failed to start checkout');
      }
      setBuying(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-bg-primary shadow-2xl">
        <div className="flex items-start justify-between border-b border-border-color p-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Top up credits</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Credits power your follow-ups, AI replies, and automated campaigns.
              1 credit = 1 outbound WhatsApp template send.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1,2,3,4].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-bg-secondary" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {packs.map((pack, idx) => (
                <PackCard
                  key={pack.slug}
                  pack={pack}
                  featured={idx === 1}  // highlight Saver as best value
                  busy={buying === pack.slug}
                  disabled={buying !== null && buying !== pack.slug}
                  onBuy={() => handleBuy(pack)}
                />
              ))}
            </div>
          )}
          <p className="mt-6 text-center text-xs text-text-secondary">
            Credits never expire on top-up packs. Plan-granted credits expire at the end of your billing period.
            All payments processed securely by Razorpay.
          </p>
        </div>
      </div>
    </div>
  );
}

function PackCard({
  pack, featured, busy, disabled, onBuy,
}: {
  pack: CreditPack;
  featured?: boolean;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <div className={`relative rounded-xl border p-5 ${
      featured ? 'border-accent ring-2 ring-accent/30' : 'border-border-color'
    } bg-bg-primary`}>
      {featured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Best value
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{pack.name}</p>
      <p className="mt-2 text-3xl font-bold text-text-primary">
        {pack.credits.toLocaleString()}
        {pack.bonus_credits > 0 && (
          <span className="ml-1 text-base font-normal text-emerald-600 dark:text-emerald-400">
            +{pack.bonus_credits.toLocaleString()}
          </span>
        )}
      </p>
      <p className="text-xs text-text-secondary">credits</p>

      <div className="my-4 h-px bg-border-color" />

      <p className="text-2xl font-bold text-text-primary">₹{pack.price_inr.toLocaleString()}</p>
      <p className="text-xs text-text-secondary">
        ₹{pack.per_credit_inr.toFixed(2)} per credit
      </p>

      <button
        type="button"
        onClick={onBuy}
        disabled={busy || disabled}
        className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
          featured
            ? 'bg-accent text-white hover:opacity-90'
            : 'border border-border-color text-text-primary hover:bg-bg-secondary'
        } disabled:opacity-50`}
      >
        {busy ? 'Opening checkout…' : `Buy ${pack.total_credits.toLocaleString()} credits`}
      </button>
    </div>
  );
}
