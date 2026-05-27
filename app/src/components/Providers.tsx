'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useDummyData } from '@/lib/config';
import { hydrateFromApi } from '@/lib/hydrate-store';
import '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme, isAuthenticated, isHydrated, isHydrating } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // On refresh in real mode, re-hydrate from API when session cookie exists
  useEffect(() => {
    if (useDummyData || !isAuthenticated || isHydrated || isHydrating) return;

    hydrateFromApi().catch(() => {
      useAppStore.getState().logout();
    });
  }, [isAuthenticated, isHydrated, isHydrating]);

  return <>{children}</>;
};
