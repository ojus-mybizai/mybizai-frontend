'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Coins, AlertCircle, ChevronRight, Loader2, ShoppingCart, TrendingUp,
  History, Bot, Cpu,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  getUsage, getTopupPacks, createTopupOrder, getUsageTrend,
  getCreditLedger,
  type UsageData, type CreditPack, type UsageTrendResponse,
  type CreditLedgerEntry,
} from '@/services/billing';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CreditsPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [pricePerCredit, setPricePerCredit] = useState<number>(0.5);
  const [trend, setTrend] = useState<UsageTrendResponse | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const [ledgerHasMore, setLedgerHasMore] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'grant' | 'debit' | 'refund'>('all');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getUsage(),
      getTopupPacks(),
      getUsageTrend(30).catch(() => null),
      getCreditLedger(25, 0).catch(() => ({ entries: [], limit: 25, offset: 0 })),
    ])
      .then(([u, p, t, l]) => {
        if (cancelled) return;
        setUsage(u);
        setPacks(p.packs);
        setPricePerCredit(p.price_per_credit_inr);
        setTrend(t);
        setLedger(l.entries);
        setLedgerHasMore(l.entries.length === 25);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load credits data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshAfterTopup = async () => {
    const [u, l] = await Promise.all([
      getUsage(),
      getCreditLedger(25, 0).catch(() => ({ entries: [], limit: 25, offset: 0 })),
    ]);
    setUsage(u);
    setLedger(l.entries);
    setLedgerOffset(0);
    setLedgerHasMore(l.entries.length === 25);
  };

  const handleBuy = async (input: { packId?: string; customAmountInr?: number }) => {
    const key = input.packId || `custom_${input.customAmountInr}`;
    setBuying(key);
    setError(null);
    setNotice(null);
    try {
      const order = await createTopupOrder(input);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setError('Razorpay checkout failed to load. Check your network.');
        setBuying(null);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.order_id,
        prefill: order.prefill,
        theme: { color: '#7c3aed' },
        handler: async () => {
          // Payment success — webhook will grant credits asynchronously.
          // Show immediate feedback and refresh in 3s to catch the grant.
          setNotice(`Payment successful! ${order.credits.toLocaleString()} credits arriving shortly...`);
          setTimeout(() => { void refreshAfterTopup(); }, 3000);
        },
        modal: {
          ondismiss: () => { setBuying(null); },
        },
      });
      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      setError(msg);
      setBuying(null);
    }
  };

  const loadMoreLedger = async () => {
    const next = ledgerOffset + 25;
    const more = await getCreditLedger(25, next);
    setLedger([...ledger, ...more.entries]);
    setLedgerOffset(next);
    setLedgerHasMore(more.entries.length === 25);
  };

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return ledger;
    return ledger.filter((e) => e.entry_type === ledgerFilter);
  }, [ledger, ledgerFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-2 text-text-secondary">Loading credits...</span>
      </div>
    );
  }

  const credits = usage?.credits;
  const monthlyPct = credits?.monthly_cap && credits.monthly_cap > 0
    ? Math.min(100, (credits.current_month_used / credits.monthly_cap) * 100)
    : 0;
  const daysToExpiry = credits?.expires_at
    ? Math.max(0, Math.ceil((new Date(credits.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const customAmountInr = parseInt(customAmount, 10);
  const customCredits = !Number.isNaN(customAmountInr) && customAmountInr >= 100
    ? Math.floor(customAmountInr / pricePerCredit)
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <nav className="flex items-center gap-1 text-xs text-text-secondary">
        <Link href="/settings" className="font-semibold text-accent hover:underline">Settings</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/settings/billing" className="text-text-secondary hover:text-text-primary">Billing</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-primary">AI Credits</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-500" />
          AI Credits
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Every AI reply uses credits. {pricePerCredit && `Top-ups are flat ₹${pricePerCredit}/credit — no expiry on bought credits for 12 months.`}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-300 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}

      {/* ═══ Section 1: Headline ═════════════════════════════════════════ */}
      <section className={`rounded-xl border-2 p-6 ${
        credits?.low_balance_warning
          ? 'border-amber-300 bg-amber-50'
          : 'border-border-color bg-card-bg'
      }`}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">Current balance</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-text-primary">
                {credits?.balance?.toLocaleString() ?? 0}
              </span>
              <span className="text-sm text-text-secondary">credits</span>
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              ≈ {rupees((credits?.balance || 0) * pricePerCredit)} value
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">This month</span>
            <div className="mt-2 text-2xl font-bold text-text-primary">
              {credits?.current_month_used?.toLocaleString() ?? 0}
              {credits?.monthly_cap && (
                <span className="text-sm text-text-secondary ml-2">/ {credits.monthly_cap.toLocaleString()} cap</span>
              )}
            </div>
            {credits?.monthly_cap ? (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${
                    monthlyPct >= 90 ? 'bg-red-500' : monthlyPct >= 70 ? 'bg-amber-500' : 'bg-accent'
                  }`}
                  style={{ width: `${monthlyPct}%` }}
                />
              </div>
            ) : null}
          </div>

          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">Plan credits expire</span>
            <div className="mt-2 text-2xl font-bold text-text-primary">
              {daysToExpiry !== null ? (
                <>
                  {daysToExpiry} <span className="text-sm font-normal text-text-secondary">days</span>
                </>
              ) : (
                <span className="text-sm font-normal text-text-secondary">No expiry</span>
              )}
            </div>
            {credits?.expires_at && (
              <div className="mt-1 text-xs text-text-secondary">
                On {new Date(credits.expires_at).toLocaleDateString()}
              </div>
            )}
            <div className="mt-2 text-xs text-text-secondary">
              Lifetime: {credits?.lifetime_granted?.toLocaleString()} granted · {credits?.lifetime_consumed?.toLocaleString()} used
            </div>
          </div>
        </div>

        {credits?.low_balance_warning && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span><strong>Running low.</strong> The AI will pause when you hit zero. Buy a top-up below to keep your agents online.</span>
          </div>
        )}
      </section>

      {/* ═══ Section 2: Top-up ═══════════════════════════════════════════ */}
      <section>
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-3">
          <ShoppingCart className="h-4 w-4 text-text-secondary" />
          Buy more credits
        </h2>
        <p className="text-xs text-text-secondary mb-4">
          Flat rate ₹{pricePerCredit}/credit. Credits never expire for 12 months after purchase. Instant top-up via Razorpay.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => {
            const isLoading = buying === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleBuy({ packId: pack.id })}
                disabled={buying !== null}
                className="group flex flex-col items-start rounded-xl border-2 border-border-color bg-card-bg p-4 text-left transition-all hover:border-accent hover:shadow-md disabled:opacity-50"
              >
                <div className="rounded-lg bg-amber-100 p-1.5 text-amber-800 mb-2">
                  <Coins className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-text-primary">{pack.credits.toLocaleString()}</span>
                <span className="text-xs text-text-secondary">credits</span>
                <span className="mt-2 text-base font-extrabold text-text-primary">{rupees(pack.price_inr)}</span>
                <span className="mt-3 w-full rounded-md bg-accent px-3 py-1.5 text-center text-xs font-semibold text-white group-hover:bg-accent-dark transition-colors">
                  {isLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Buy'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom amount */}
        <div className="mt-4 rounded-xl border border-border-color bg-card-bg p-4">
          <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary mb-2">Custom amount</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-md border border-border-color bg-bg-secondary px-2">
              <span className="text-sm text-text-secondary">₹</span>
              <input
                type="number"
                min={100}
                max={500000}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="500"
                className="w-28 bg-transparent px-2 py-1.5 text-sm text-text-primary focus:outline-none"
              />
            </div>
            {customCredits > 0 && (
              <span className="text-xs text-text-secondary">
                = <strong className="text-text-primary">{customCredits.toLocaleString()}</strong> credits
              </span>
            )}
            <button
              type="button"
              onClick={() => handleBuy({ customAmountInr: customAmountInr })}
              disabled={buying !== null || !customAmountInr || customAmountInr < 100}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {buying?.startsWith('custom_') ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : 'Buy'}
            </button>
            <span className="ml-auto text-[11px] text-text-secondary">Min ₹100 · Max ₹5,00,000</span>
          </div>
        </div>
      </section>

      {/* ═══ Section 3: Usage trend ══════════════════════════════════════ */}
      <section>
        <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-text-secondary" />
          Usage (last 30 days)
        </h2>

        {trend && trend.trend.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Chart */}
            <div className="lg:col-span-2 rounded-xl border border-border-color bg-card-bg p-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => {
                      const dt = new Date(d);
                      return `${dt.getDate()}/${dt.getMonth() + 1}`;
                    }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(d) => new Date(d).toLocaleDateString()}
                      formatter={(v, name) => [
                        Number(v ?? 0).toLocaleString(),
                        String(name) === 'credits' ? 'Credits' : String(name ?? ''),
                      ] as [string, string]}
                    />
                    <Area type="monotone" dataKey="credits" stroke="#7c3aed" strokeWidth={2} fill="url(#creditGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By model */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                By model
              </h3>
              {trend.by_model.length > 0 ? (
                <ul className="space-y-2">
                  {trend.by_model.slice(0, 5).map((m) => (
                    <li key={m.model} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-text-primary truncate">{m.model}</span>
                      <span className="text-text-secondary">
                        <strong className="text-text-primary">{m.credits.toLocaleString()}</strong>
                        <span className="ml-1">cr</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">No usage yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-text-secondary opacity-50" />
            <p className="mt-2 text-sm text-text-secondary">No AI activity in the last 30 days yet</p>
          </div>
        )}

        {/* By agent */}
        {trend && trend.by_agent.length > 0 && (
          <div className="mt-4 rounded-xl border border-border-color bg-card-bg p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3 flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Top consuming agents
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-border-color">
                  <th className="text-left pb-2 font-medium">Agent</th>
                  <th className="text-right pb-2 font-medium">Runs</th>
                  <th className="text-right pb-2 font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {trend.by_agent.map((a) => (
                  <tr key={a.agent_id} className="border-b border-border-color last:border-0">
                    <td className="py-2">
                      <Link href={`/agents/${a.agent_id}`} className="text-accent hover:underline">
                        Agent #{a.agent_id}
                      </Link>
                    </td>
                    <td className="py-2 text-right text-text-secondary">{a.runs.toLocaleString()}</td>
                    <td className="py-2 text-right font-semibold text-text-primary">{a.credits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ═══ Section 4: Ledger ═══════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <History className="h-4 w-4 text-text-secondary" />
            Transaction history
          </h2>
          <div className="inline-flex rounded-md border border-border-color bg-card-bg p-0.5 text-xs">
            {(['all', 'grant', 'debit', 'refund'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLedgerFilter(f)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                  ledgerFilter === f ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredLedger.length > 0 ? (
          <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-bg-secondary">
                <tr className="text-text-secondary">
                  <th className="text-left px-4 py-2.5 font-medium">When</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Description</th>
                  <th className="text-right px-4 py-2.5 font-medium">Δ Credits</th>
                  <th className="text-right px-4 py-2.5 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry) => (
                  <tr key={entry.id} className="border-t border-border-color">
                    <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        entry.entry_type === 'grant' ? 'bg-emerald-100 text-emerald-800'
                        : entry.entry_type === 'debit' ? 'bg-blue-100 text-blue-800'
                        : entry.entry_type === 'refund' ? 'bg-purple-100 text-purple-800'
                        : entry.entry_type === 'expiry' ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                      }`}>
                        {entry.entry_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-primary">
                      {entry.description || entry.source}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${
                      entry.credits_delta > 0 ? 'text-emerald-600' : 'text-text-primary'
                    }`}>
                      {entry.credits_delta > 0 ? '+' : ''}{entry.credits_delta.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary tabular-nums">
                      {entry.balance_after.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledgerHasMore && (
              <div className="border-t border-border-color px-4 py-2.5 text-center">
                <button
                  onClick={loadMoreLedger}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center">
            <History className="mx-auto h-8 w-8 text-text-secondary opacity-50" />
            <p className="mt-2 text-sm text-text-secondary">No transactions yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
