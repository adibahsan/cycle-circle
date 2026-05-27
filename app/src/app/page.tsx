'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, onboardingComplete } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!onboardingComplete) {
      router.replace('/onboarding');
    } else {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, onboardingComplete, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="animate-pulse text-[var(--color-primary)] text-xl font-semibold">Vesta</div>
    </div>
  );
}
