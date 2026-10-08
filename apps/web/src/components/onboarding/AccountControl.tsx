'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, UserCircle } from 'lucide-react';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';

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
          className={`sr-only sm:not-sr-only sm:truncate sm:max-w-[8rem] text-xs text-[var(--color-text-muted)] ${
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

      <LogoutConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        loggingOut={loggingOut}
        onConfirm={() => {
          setShowConfirm(false);
          handleLogout();
        }}
      />
    </>
  );
}
