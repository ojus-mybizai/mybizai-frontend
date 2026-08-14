'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ConsoleTab = 'chat' | 'tasks' | 'activity';

interface TaskConsoleState {
  composerDrafts: Record<number, string>;
  doneCollapsed: boolean;
  setDraft: (memberId: number, text: string) => void;
  clearDraft: (memberId: number) => void;
  toggleDone: () => void;
}

export const useTaskConsole = create<TaskConsoleState>()(
  persist(
    (set) => ({
      composerDrafts: {},
      doneCollapsed: true,
      setDraft: (memberId, text) =>
        set((s) => ({ composerDrafts: { ...s.composerDrafts, [memberId]: text } })),
      clearDraft: (memberId) =>
        set((s) => {
          const next = { ...s.composerDrafts };
          delete next[memberId];
          return { composerDrafts: next };
        }),
      toggleDone: () => set((s) => ({ doneCollapsed: !s.doneCollapsed })),
    }),
    {
      name: 'task-console',
      storage: {
        getItem: (name) => {
          if (typeof sessionStorage === 'undefined') return null;
          const raw = sessionStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => {
          if (typeof sessionStorage === 'undefined') return;
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          if (typeof sessionStorage === 'undefined') return;
          sessionStorage.removeItem(name);
        },
      },
    },
  ),
);
