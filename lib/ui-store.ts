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
  /** "Configure" (setup/config) sidebar group open state (persisted).
      Defaults closed so the daily rail stays lean; opens on demand. */
  configOpen: boolean;
  /** Becomes true once UIController has hydrated from localStorage */
  hydrated: boolean;

  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebar: () => void;
  setHoverExpandEnabled: (enabled: boolean) => void;
  setHoverExpanded: (value: boolean) => void;
  setInboxRailCollapsed: (value: boolean) => void;
  toggleInboxRail: () => void;
  setConfigOpen: (value: boolean) => void;
  toggleConfig: () => void;
  setHydrated: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarMode: "expanded",
  hoverExpandEnabled: true,
  isHoverExpanded: false,
  inboxRailCollapsed: false,
  configOpen: false,
  hydrated: false,

  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  toggleSidebar: () =>
    set({ sidebarMode: get().sidebarMode === "expanded" ? "collapsed" : "expanded" }),
  setHoverExpandEnabled: (enabled) => set({ hoverExpandEnabled: enabled }),
  setHoverExpanded: (value) => set({ isHoverExpanded: value }),
  setInboxRailCollapsed: (value) => set({ inboxRailCollapsed: value }),
  toggleInboxRail: () => set({ inboxRailCollapsed: !get().inboxRailCollapsed }),
  setConfigOpen: (value) => set({ configOpen: value }),
  toggleConfig: () => set({ configOpen: !get().configOpen }),
  setHydrated: (value) => set({ hydrated: value }),
}));
