'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const noop = () => {};

export function TrialExpiredLock() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed anyway
    }
    router.push('/login');
  }, [router]);

  return (
    <Modal
      open
      onClose={noop}
      layer="lock"
      dismissible={false}
      titleId="trial-expired-title"
      descId="trial-expired-desc"
      panelClassName="sm:max-w-sm"
    >
      <div className="p-6 text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--goal-accent)] flex items-center justify-center shadow-glow">
            <Lock size={28} className="text-[var(--color-on-accent)]" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 id="trial-expired-title" className="text-xl font-bold text-[var(--color-text-primary)]">
            {t('trialExpired.title')}
          </h2>
          <p id="trial-expired-desc" className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {t('trialExpired.body')}
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <Link
            href="/subscription"
            data-autofocus
            className="inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-base font-semibold bg-[var(--color-action)] text-[var(--color-on-action)] shadow-soft hover:opacity-90 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          >
            {t('trialExpired.upgradeCta')}
          </Link>

          <Button variant="ghost" fullWidth onClick={handleLogout}>
            {t('trialExpired.logout')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
