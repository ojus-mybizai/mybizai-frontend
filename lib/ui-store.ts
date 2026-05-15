import { create } from "zustand";

export type SidebarMode = "expanded" | "collapsed";

interface UIState {
  /** User's pinned sidebar preference (persisted) */
  sidebarMode: SidebarMode;
  /** When true, a collapsed sidebar grows on hover (persisted) */
  hoverExpandEnabled: boolean;
  /** Transient: true while a collapsed sidebar is being hovered (not persisted) */
  isHoverExpanded: boolean;
  /** Inbox right rail collapsed state (persisted) */
  inboxRailCollapsed: boolean;
  /** Becomes true once UIController has hydrated from localStorage */
  hydrated: boolean;

  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: () => void;
  setHoverExpandEnabled: (enabled: boolean) => void;
  setHoverExpanded: (value: boolean) => void;
  setInboxRailCollapsed: (value: boolean) => void;
  toggleInboxRail: () => void;
  setHydrated: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarMode: "expanded",
  hoverExpandEnabled: true,
  isHoverExpanded: false,
  inboxRailCollapsed: false,
  hydrated: false,

  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  toggleSidebar: () =>
    set({ sidebarMode: get().sidebarMode === "expanded" ? "collapsed" : "expanded" }),
  setHoverExpandEnabled: (enabled) => set({ hoverExpandEnabled: enabled }),
  setHoverExpanded: (value) => set({ isHoverExpanded: value }),
  setInboxRailCollapsed: (value) => set({ inboxRailCollapsed: value }),
  toggleInboxRail: () => set({ inboxRailCollapsed: !get().inboxRailCollapsed }),
  setHydrated: (value) => set({ hydrated: value }),
}));
