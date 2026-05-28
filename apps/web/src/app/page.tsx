'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useDummyData } from '@vesta/shared/utils/config';
import { hydrateFromApi } from '@/lib/hydrate-store';
import { getPostAuthPath } from '@/lib/post-auth';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, profiles, isHydrated, isHydrating } = useAppStore();

  useEffect(() => {
    const authSuccess =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('auth') === 'success';

    if (authSuccess && !useDummyData) {
      hydrateFromApi()
        .then(() => {
          const { profiles: hydratedProfiles } = useAppStore.getState();
          router.replace(getPostAuthPath(hydratedProfiles.length));
        })
        .catch(() => router.replace('/login'));
      return;
    }

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!useDummyData && (isHydrating || !isHydrated)) {
      return;
    }

    router.replace(getPostAuthPath(profiles.length));
  }, [isAuthenticated, profiles.length, isHydrated, isHydrating, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="animate-pulse text-[var(--color-primary)] text-xl font-semibold">Vesta</div>
    </div>
  );
}
