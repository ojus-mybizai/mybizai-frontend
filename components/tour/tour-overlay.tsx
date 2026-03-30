'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTourStore, type TourStep } from '@/lib/tour-store';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

// ── Spotlight cutout + tooltip overlay ─────────────────────────────

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // extra space around highlighted element

export function TourOverlay() {
  const { isActive, steps, currentStepIndex, nextStep, prevStep, skipTour, endTour } =
    useTourStore();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentStep: TourStep | null = isActive && steps[currentStepIndex] ? steps[currentStepIndex] : null;

  // ── Find and highlight target element ───────────────────────

  const updatePosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    // Center placement (no target element)
    if (currentStep.placement === 'center' || !currentStep.targetSelector) {
      setTargetRect(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 120,
        left: window.innerWidth / 2 - 200,
      });
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (!el) {
      // Element not found — show tooltip centered
      setTargetRect(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 120,
        left: window.innerWidth / 2 - 200,
      });
      return;
    }

    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Small delay after scroll to get accurate position
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const padded: TargetRect = {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      };
      setTargetRect(padded);

      // Calculate tooltip position
      const placement = currentStep.placement || 'bottom';
      const tooltipWidth = 360;
      const tooltipHeight = 180;
      let tTop = 0;
      let tLeft = 0;

      switch (placement) {
        case 'bottom':
          tTop = padded.top + padded.height + 12;
          tLeft = padded.left + padded.width / 2 - tooltipWidth / 2;
          break;
        case 'top':
          tTop = padded.top - tooltipHeight - 12;
          tLeft = padded.left + padded.width / 2 - tooltipWidth / 2;
          break;
        case 'right':
          tTop = padded.top + padded.height / 2 - tooltipHeight / 2;
          tLeft = padded.left + padded.width + 12;
          break;
        case 'left':
          tTop = padded.top + padded.height / 2 - tooltipHeight / 2;
          tLeft = padded.left - tooltipWidth - 12;
          break;
      }

      // Keep tooltip within viewport
      tLeft = Math.max(16, Math.min(tLeft, window.innerWidth - tooltipWidth - 16));
      tTop = Math.max(16, Math.min(tTop, window.innerHeight - tooltipHeight - 16));

      setTooltipPos({ top: tTop, left: tLeft });
    });
  }, [currentStep]);

  useEffect(() => {
    updatePosition();
    // Also update on resize
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [updatePosition]);

  // ── Keyboard navigation ─────────────────────────────────────

  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skipTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      if (e.key === 'ArrowLeft') prevStep();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, nextStep, prevStep, skipTour]);

  // ── Render ──────────────────────────────────────────────────

  if (!mounted || !isActive || !currentStep) return null;

  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isLast = currentStepIndex === steps.length - 1;
  const isFirst = currentStepIndex === 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" aria-live="polite">
      {/* ── Overlay with spotlight cutout ── */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-auto"
        style={{ zIndex: 9999 }}
        onClick={skipTour}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* ── Spotlight border (pulsing) ── */}
      {targetRect && (
        <div
          className="fixed pointer-events-none rounded-lg border-2 border-primary animate-pulse"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            zIndex: 10000,
            boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
          }}
        />
      )}

      {/* ── Tooltip card ── */}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-auto"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          zIndex: 10001,
          width: 360,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl bg-card-bg border border-border-color shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-5">
            {/* Step header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <button
                onClick={skipTour}
                className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                title="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Title + description */}
            <h3 className="text-base font-semibold text-text-primary mb-1.5">
              {currentStep.title}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {currentStep.description}
            </p>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-5">
              <button
                onClick={prevStep}
                disabled={isFirst}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={skipTour}
                  className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Skip tour
                </button>
                <button
                  onClick={isLast ? endTour : nextStep}
                  className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {isLast ? 'Finish' : 'Next'}
                  {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
