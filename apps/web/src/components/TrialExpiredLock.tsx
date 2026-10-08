'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';

export function TrialExpiredLock() {
  const { t } = useTranslation();
  const router = useRouter();
  const hasMounted = useHasMounted();
  const prefersReduced = useReducedMotion();
  const prm = hasMounted && prefersReduced;

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed anyway
    }
    router.push('/login');
  }, [router]);

  const cardInitial = prm
    ? { opacity: 1, scale: 1 }
    : { opacity: 0, scale: 0.92, y: 24 };
  const cardAnimate = { opacity: 1, scale: 1, y: 0 };
  const cardTransition = prm
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 22, stiffness: 260, delay: 0.05 };

  const backdropInitial = prm ? { opacity: 1 } : { opacity: 0 };
  const backdropAnimate = { opacity: 1 };
  const backdropTransition = prm ? { duration: 0 } : { duration: 0.25 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 overscroll-contain"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={backdropInitial}
        animate={backdropAnimate}
        transition={backdropTransition}
        aria-hidden="true"
      />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-sm"
        initial={cardInitial}
        animate={cardAnimate}
        transition={cardTransition}
      >
        <Card padding="lg" className="text-center space-y-5">
          {/* Lock icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[var(--goal-accent)] flex items-center justify-center shadow-glow">
              <Lock size={28} className="text-[var(--color-on-accent)]" aria-hidden="true" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2
              id="trial-expired-title"
              className="text-xl font-bold text-[var(--color-text-primary)]"
            >
              {t('trialExpired.title')}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {t('trialExpired.body')}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <Link href="/subscription" className="block">
              <Button
                variant="primary"
                fullWidth
                className="border-0"
              >
                {t('trialExpired.upgradeCta')}
              </Button>
            </Link>

            <Button
              variant="ghost"
              fullWidth
              onClick={handleLogout}
            >
              {t('trialExpired.logout')}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
