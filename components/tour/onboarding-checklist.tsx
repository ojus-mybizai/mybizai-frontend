'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Check,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  GraduationCap,
  Play,
  ExternalLink,
} from 'lucide-react';
import { useTourStore } from '@/lib/tour-store';

export function OnboardingChecklist() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    checklist,
    checklistVisible,
    completedItemIds,
    templateName,
    toggleChecklist,
    dismissChecklist,
    markCompleted,
  } = useTourStore();

  // ── Auto-complete items based on page visits ──────────────

  useEffect(() => {
    if (!checklist.length) return;
    for (const item of checklist) {
      if (completedItemIds.includes(item.id)) continue;
      if (item.preCompleted) {
        markCompleted(item.id);
        continue;
      }
      // Check if current path matches the item's href
      if (item.href && pathname.startsWith(item.href)) {
        markCompleted(item.id);
      }
    }
  }, [pathname, checklist, completedItemIds, markCompleted]);

  // ── Don't render if no checklist ──────────────────────────

  if (!checklist.length) return null;

  const completedCount = checklist.filter(
    (item) => completedItemIds.includes(item.id) || item.preCompleted
  ).length;
  const totalCount = checklist.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const allDone = completedCount >= totalCount;

  // ── Minimized pill (when checklist is hidden) ─────────────

  if (!checklistVisible) {
    return (
      <button
        onClick={toggleChecklist}
        className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-105"
      >
        <GraduationCap className="h-4 w-4" />
        <span>Getting Started</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {completedCount}/{totalCount}
        </span>
      </button>
    );
  }

  // ── Full checklist panel ──────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-80 rounded-2xl bg-card-bg border border-border-color shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Getting Started</h3>
              {templateName && (
                <p className="text-[10px] text-text-muted">{templateName}</p>
              )}
            </div>
          </div>
          <button
            onClick={dismissChecklist}
            className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-bg-secondary/50">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-primary">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="max-h-[50vh] overflow-y-auto px-3 py-2">
        {allDone ? (
          <div className="py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-3">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-text-primary">All done!</p>
            <p className="text-xs text-text-muted mt-1">
              You&apos;ve explored all the key features. You&apos;re ready to go!
            </p>
            <button
              onClick={dismissChecklist}
              className="mt-3 text-xs text-primary hover:underline font-medium"
            >
              Dismiss checklist
            </button>
          </div>
        ) : (
          <div className="space-y-0.5 py-1">
            {checklist.map((item) => {
              const isCompleted = completedItemIds.includes(item.id) || item.preCompleted;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.href) {
                      router.push(item.href);
                      markCompleted(item.id);
                    }
                  }}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors group ${
                    isCompleted
                      ? 'opacity-60'
                      : 'hover:bg-bg-secondary/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Check icon */}
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border-color group-hover:border-primary transition-colors">
                          <Circle className="h-2 w-2 text-transparent group-hover:text-primary transition-colors" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        isCompleted
                          ? 'text-text-muted line-through'
                          : 'text-text-primary'
                      }`}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    </div>

                    {/* Navigate arrow */}
                    {!isCompleted && item.href && (
                      <ExternalLink className="h-3.5 w-3.5 text-text-muted/40 group-hover:text-primary transition-colors mt-1 shrink-0" />
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
