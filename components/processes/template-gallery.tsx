'use client';

import React, { useEffect, useState } from 'react';
import {
  listProcessTemplates, createFromTemplate, type ProcessTemplateStarter,
} from '@/services/processes';

interface Props {
  onCreated: (processId: number) => void;
  onClose: () => void;
}

const INDUSTRY_COLOR: Record<string, string> = {
  'Sales': '#3B82F6',
  'Healthcare / Services': '#10B981',
  'HR / Recruiting': '#8B5CF6',
  'Retail / Manufacturing': '#F59E0B',
  'Finance': '#06B6D4',
  'Agencies / Services': '#EC4899',
  'Customer Support': '#EF4444',
  'Real Estate': '#6366F1',
};

export default function TemplateGallery({ onCreated, onClose }: Props) {
  const [templates, setTemplates] = useState<ProcessTemplateStarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    listProcessTemplates().then(setTemplates).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handlePick(key: string) {
    setCreating(key);
    try {
      const p = await createFromTemplate(key);
      onCreated(p.id);
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Start from a template</h2>
            <p className="text-sm text-text-secondary">Pre-built pipelines with stages, SLAs, and win probabilities.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary text-text-secondary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 rounded-lg bg-bg-secondary animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(t => {
              const color = INDUSTRY_COLOR[t.industry] || '#3B82F6';
              return (
                <button
                  key={t.key}
                  onClick={() => handlePick(t.key)}
                  disabled={creating !== null}
                  className="text-left rounded-lg border border-border-color bg-bg-primary p-4 hover:border-accent hover:shadow-md transition-all disabled:opacity-50 group"
                  style={{ borderLeftWidth: '4px', borderLeftColor: color }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-text-secondary font-medium">{t.industry}</p>
                    {creating === t.key && (
                      <svg className="h-3 w-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                        <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">{t.name}</p>
                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">{t.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.stages.slice(0, 5).map((s: any, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] rounded-full px-1.5 py-px font-medium"
                        style={{ background: (s.color || '#6B7280') + '22', color: s.color || '#6B7280' }}
                      >
                        {s.name}
                      </span>
                    ))}
                    {t.stages.length > 5 && (
                      <span className="text-[10px] text-text-secondary">+{t.stages.length - 5}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
