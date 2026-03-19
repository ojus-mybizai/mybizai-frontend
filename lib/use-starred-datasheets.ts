'use client';

/**
 * useStarredDatasheets — persists starred datasheet IDs in localStorage.
 *
 * • Reactive: components re-render when star state changes
 * • Cross-component sync: dispatches a custom event so DataSheetNav and
 *   ModelDirectoryPage both update without a page reload
 * • SSR safe: reads localStorage only on the client
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mybizai:starred_datasheets';
const CHANGE_EVENT = 'mybizai:starred_datasheets_changed';

function readStarred(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeStarred(ids: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  // Notify other components on the same page
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useStarredDatasheets() {
  const [starred, setStarred] = useState<number[]>([]);

  // Hydrate on mount and subscribe to changes
  useEffect(() => {
    setStarred(readStarred());

    const sync = () => setStarred(readStarred());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync); // cross-tab sync
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleStar = useCallback((id: number) => {
    const current = readStarred();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    writeStarred(next);
    setStarred(next);
  }, []);

  const isStarred = useCallback((id: number) => starred.includes(id), [starred]);

  return { starred, toggleStar, isStarred };
}
