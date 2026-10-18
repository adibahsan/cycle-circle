'use client';

import { useCallback, useEffect, useState } from 'react';

export const SIDEBAR_STORAGE_KEY = 'vesta.sidebarCollapsed';
/** Width (px) from which the sidebar is expanded by default. Matches Tailwind `xl`. */
export const SIDEBAR_WIDE_QUERY = '(min-width: 1280px)';

/** `auto` = no stored choice yet: CSS breakpoints decide (collapsed md..xl-1, expanded xl+). */
export type SidebarPref = 'auto' | 'true' | 'false';

export function parseSidebarPref(raw: string | null | undefined): SidebarPref {
  return raw === 'true' || raw === 'false' ? raw : 'auto';
}

export function resolveCollapsed(pref: SidebarPref, isWide: boolean): boolean {
  return pref === 'auto' ? !isWide : pref === 'true';
}

function readPref(): SidebarPref {
  try {
    return parseSidebarPref(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

function writePref(pref: SidebarPref) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, pref);
  } catch {
    /* storage blocked: the choice just won't persist */
  }
}

/**
 * Sidebar collapsed state. `pref` drives the `data-collapsed` attribute (SSR-safe: starts as
 * `auto`, so the first paint follows CSS breakpoints); `collapsed` is the effective boolean
 * used for the toggle's icon, label and aria-expanded.
 */
export function useSidebarCollapsed() {
  const [pref, setPref] = useState<SidebarPref>('auto');
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    setPref(readPref());
    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia(SIDEBAR_WIDE_QUERY);
    } catch {
      return;
    }
    const sync = () => setIsWide(mql!.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql!.removeEventListener('change', sync);
  }, []);

  const collapsed = resolveCollapsed(pref, isWide);

  const toggle = useCallback(() => {
    const next: SidebarPref = collapsed ? 'false' : 'true';
    setPref(next);
    writePref(next);
  }, [collapsed]);

  return { pref, collapsed, toggle };
}
