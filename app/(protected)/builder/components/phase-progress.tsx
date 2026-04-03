'use client';

import { Check } from 'lucide-react';

const PHASE_LABELS: Record<string, string> = {
  greeting: 'Welcome',
  identity: 'Business Info',
  operations: 'Operations',
  customer_journey: 'Customer Journey',
  data_needs: 'Data Tracking',
  automation: 'Automation',
  channels: 'Channels',
  team: 'Team & Roles',
  review: 'Review',
  generating: 'Generating',
  applying: 'Applying',
  complete: 'Complete',
};

// Only show user-facing phases in the stepper
const VISIBLE_PHASES = [
  'identity',
  'operations',
  'customer_journey',
  'data_needs',
  'automation',
  'channels',
  'team',
  'review',
  'complete',
];

interface Props {
  progress: Record<string, string>;
  currentPhase: string;
}

export default function PhaseProgress({ progress, currentPhase }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {VISIBLE_PHASES.map((phase, i) => {
        const status = progress[phase] || 'pending';
        const isComplete = status === 'complete';
        const isCurrent = status === 'current';
        const label = PHASE_LABELS[phase] || phase;

        return (
          <div key={phase} className="flex items-center gap-3 py-1.5">
            {/* Indicator */}
            <div className="flex w-5 h-5 items-center justify-center shrink-0">
              {isComplete ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
                  <Check size={12} className="text-green-500" />
                </div>
              ) : isCurrent ? (
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <div className="absolute h-5 w-5 animate-ping rounded-full bg-accent/30" />
                  <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                </div>
              ) : (
                <div className="h-2 w-2 rounded-full bg-white/20" />
              )}
            </div>

            {/* Label */}
            <span
              className={`text-xs ${
                isCurrent
                  ? 'font-semibold text-text-primary'
                  : isComplete
                  ? 'text-text-secondary'
                  : 'text-text-secondary/50'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
