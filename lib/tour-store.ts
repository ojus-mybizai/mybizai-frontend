/**
 * Tour & Onboarding Checklist — Zustand store
 *
 * Manages the interactive page tour (spotlight + tooltip) and
 * the persistent onboarding checklist. Tour steps are dynamically
 * generated from the applied business template.
 */

import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────

export interface TourStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector for the element to highlight (e.g., '[data-tour="sidebar-datasheets"]') */
  targetSelector: string;
  /** If set, navigate to this path before highlighting */
  targetPage?: string;
  /** Tooltip placement relative to target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Icon name (lucide) */
  icon?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  /** Page to navigate to when clicked */
  href: string;
  /** Icon name (lucide) */
  icon?: string;
  /** If true, this item is pre-completed (e.g., "Apply template") */
  preCompleted?: boolean;
}

interface TourState {
  // ── Tour ──
  isActive: boolean;
  steps: TourStep[];
  currentStepIndex: number;
  tourId: string | null;
  /** Set to true when a tour is queued (e.g., after template apply, before navigating to dashboard) */
  pendingTour: boolean;

  // ── Checklist ──
  checklist: ChecklistItem[];
  checklistVisible: boolean;
  completedItemIds: string[];
  templateName: string | null;

  // ── Tour actions ──
  startTour: (tourId: string, steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  setPendingTour: (pending: boolean) => void;

  // ── Checklist actions ──
  setChecklist: (templateName: string, items: ChecklistItem[]) => void;
  markCompleted: (itemId: string) => void;
  toggleChecklist: () => void;
  dismissChecklist: () => void;
  resetAll: () => void;
}

// ── LocalStorage helpers ──────────────────────────────────────────────

const STORAGE_KEY = 'mybizai-onboarding';

function loadCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveCompleted(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

// ── Store ─────────────────────────────────────────────────────────────

export const useTourStore = create<TourState>((set, get) => ({
  // Tour
  isActive: false,
  steps: [],
  currentStepIndex: 0,
  tourId: null,
  pendingTour: false,

  // Checklist
  checklist: [],
  checklistVisible: false,
  completedItemIds: loadCompleted(),
  templateName: null,

  // ── Tour actions ──────────────────────────────────────────

  startTour: (tourId, steps) =>
    set({
      isActive: true,
      tourId,
      steps,
      currentStepIndex: 0,
      pendingTour: false,
    }),

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    if (currentStepIndex < steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      // Tour finished
      get().endTour();
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  skipTour: () =>
    set({
      isActive: false,
      steps: [],
      currentStepIndex: 0,
      tourId: null,
      // Show checklist when tour is skipped so user still has guidance
      checklistVisible: true,
    }),

  endTour: () =>
    set({
      isActive: false,
      steps: [],
      currentStepIndex: 0,
      tourId: null,
      checklistVisible: true,
    }),

  setPendingTour: (pending) => set({ pendingTour: pending }),

  // ── Checklist actions ─────────────────────────────────────

  setChecklist: (templateName, items) =>
    set({
      templateName,
      checklist: items,
      checklistVisible: true,
    }),

  markCompleted: (itemId) => {
    const { completedItemIds } = get();
    if (completedItemIds.includes(itemId)) return;
    const updated = [...completedItemIds, itemId];
    saveCompleted(updated);
    set({ completedItemIds: updated });
  },

  toggleChecklist: () =>
    set((s) => ({ checklistVisible: !s.checklistVisible })),

  dismissChecklist: () =>
    set({ checklistVisible: false }),

  resetAll: () => {
    saveCompleted([]);
    set({
      isActive: false,
      steps: [],
      currentStepIndex: 0,
      tourId: null,
      pendingTour: false,
      checklist: [],
      checklistVisible: false,
      completedItemIds: [],
      templateName: null,
    });
  },
}));
