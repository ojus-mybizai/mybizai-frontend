import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, variant?: ToastVariant, duration?: number) => void;
  remove: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, variant = 'info', duration = 3000) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shorthand helpers */
export const toast = {
  success: (msg: string, duration?: number) => useToastStore.getState().add(msg, 'success', duration),
  error: (msg: string, duration?: number) => useToastStore.getState().add(msg, 'error', duration),
  info: (msg: string, duration?: number) => useToastStore.getState().add(msg, 'info', duration),
};
