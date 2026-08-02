'use client';

import { useEffect } from 'react';
import { useUIStore, type SidebarMode } from '@/lib/ui-store';

const STORAGE_KEY_MODE = 'sidebar-mode';
const STORAGE_KEY_HOVER = 'sidebar-hover-expand';
const STORAGE_KEY_INBOX_RAIL = 'inbox-rail-collapsed';
const STORAGE_KEY_CONFIG_OPEN = 'sidebar-config-open';

function readMode(): SidebarMode {
  if (typeof window === 'undefined') return 'expanded';
  const stored = window.localStorage.getItem(STORAGE_KEY_MODE);
  return stored === 'collapsed' ? 'collapsed' : 'expanded';
}

function readHoverPref(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STORAGE_KEY_HOVER);
  return stored === null ? true : stored !== 'false';
}

function readInboxRailCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(STORAGE_KEY_INBOX_RAIL);
  return stored === 'true';
}

function readConfigOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(STORAGE_KEY_CONFIG_OPEN);
  return stored === 'true';
}

export default function UIController() {
  const sidebarMode = useUIStore((s) => s.sidebarMode);
  const hoverExpandEnabled = useUIStore((s) => s.hoverExpandEnabled);
  const inboxRailCollapsed = useUIStore((s) => s.inboxRailCollapsed);
  const configOpen = useUIStore((s) => s.configOpen);
  const hydrated = useUIStore((s) => s.hydrated);
  const setSidebarMode = useUIStore((s) => s.setSidebarMode);
  const setHoverExpandEnabled = useUIStore((s) => s.setHoverExpandEnabled);
  const setInboxRailCollapsed = useUIStore((s) => s.setInboxRailCollapsed);
  const setConfigOpen = useUIStore((s) => s.setConfigOpen);
  const setHydrated = useUIStore((s) => s.setHydrated);

  useEffect(() => {
    setSidebarMode(readMode());
    setHoverExpandEnabled(readHoverPref());
    setInboxRailCollapsed(readInboxRailCollapsed());
    setConfigOpen(readConfigOpen());
    setHydrated(true);
  }, [setSidebarMode, setHoverExpandEnabled, setInboxRailCollapsed, setConfigOpen, setHydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_MODE, sidebarMode);
  }, [sidebarMode, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_HOVER, String(hoverExpandEnabled));
  }, [hoverExpandEnabled, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_INBOX_RAIL, String(inboxRailCollapsed));
  }, [inboxRailCollapsed, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY_CONFIG_OPEN, String(configOpen));
  }, [configOpen, hydrated]);

  return null;
}
