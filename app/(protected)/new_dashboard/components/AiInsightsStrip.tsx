'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface Insight {
  key: string;
  severity: 'info' | 'warn' | 'danger';
  label: string;
  href: string;
}

const SEVERITY: Record<Insight['severity'], { icon: React.ElementType; cls: string; chip: string }> = {
  info:   { icon: Info,           cls: 'text-blue-500',   chip: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'      },
  warn:   { icon: AlertTriangle,  cls: 'text-amber-500',  chip: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'  },
  danger: { icon: AlertCircle,    cls: 'text-red-500',    chip: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'          },
};

export function AiInsightsStrip() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ insights: Insight[] }>('/widgets/ai-insights')
      .then((r) => setItems(r.insights))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <div className="mb-7 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/15 dark:to-purple-900/15 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo-500" />
        <p className="text-sm font-semibold text-text-primary">Needs your attention</p>
      </div>
      {loading ? (
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (<div key={i} className="h-8 w-44 bg-bg-secondary rounded-full animate-pulse shrink-0" />))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => {
            const meta = SEVERITY[it.severity];
            const Icon = meta.icon;
            return (
              <Link
                key={it.key}
                href={it.href}
                className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-medium border border-transparent hover:border-border-color transition-colors ${meta.chip}`}
              >
                <Icon size={12} className={meta.cls} />
                {it.label}
                <ArrowRight size={11} className="opacity-60" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
