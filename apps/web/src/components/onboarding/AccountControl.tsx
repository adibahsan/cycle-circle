'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AccountControlProps {
  user: { phone: string | null; email: string | null };
  className?: string;
}

export function AccountControl({ user, className }: AccountControlProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const identity = user.phone
    ? user.phone.startsWith('+')
      ? user.phone
      : '+' + user.phone
    : (user.email ?? '');

  const isPhone = Boolean(user.phone);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // proceed anyway
    }
    router.push('/login');
  }, [loggingOut, router]);

  // ESC-to-close
  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowConfirm(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showConfirm]);

  return (
    <>
      {/* Compact chip: icon + truncated identity + logout icon-button */}
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <UserCircle
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-text-muted)]"
        />
        <span
          className={`truncate max-w-[8rem] text-xs text-[var(--color-text-muted)] ${
            isPhone ? 'font-mono' : ''
          }`}
          {...(!isPhone ? { spellCheck: false } : {})}
        >
          {identity}
        </span>
        <button
          type="button"
          aria-label={t('settings.logout')}
          onClick={() => setShowConfirm(true)}
          className="shrink-0 rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Logout confirmation modal */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.logout')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 mx-4 max-w-sm w-full shadow-lg"
            style={{ overscrollBehavior: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              {t('settings.logout')}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5">
              {t('settings.logoutConfirmMsg')}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setShowConfirm(false)}
                className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  setShowConfirm(false);
                  handleLogout();
                }}
                disabled={loggingOut}
                className="bg-[var(--color-error)] hover:opacity-90 text-[var(--color-on-action)] border-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                {loggingOut ? t('settings.loggingOut') : t('settings.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
