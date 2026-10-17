'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AddPhoneDialog } from '@/components/AddPhoneDialog';
import { getTrialStatus, getTrialMsLeft } from '@vesta/shared/utils/trial';

type TrialUser = {
  authMethod?: string | null;
  subscriptionStatus?: string | null;
  emailTrialExpiresAt?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHMS(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

interface TrialCountdownPillProps {
  trialUser: TrialUser | null;
  onPhoneAdded: (status?: string) => void;
}

export function TrialCountdownPill({ trialUser, onPhoneAdded }: TrialCountdownPillProps) {
  const { t } = useTranslation();

  // ── Live countdown ──────────────────────────────────────────────────────────
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!trialUser) return;
    const initial = getTrialMsLeft(trialUser);
    setMsLeft(initial);
    if (initial === null || initial <= 0) return;

    const id = setInterval(() => {
      const remaining = getTrialMsLeft(trialUser);
      setMsLeft(remaining);
      if (remaining === null || remaining <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [trialUser]);

  const [open, setOpen] = useState(false);

  if (!trialUser || getTrialStatus(trialUser) !== 'active') return null;
  // Suppress until first tick (avoids SSR mismatch)
  if (msLeft === null) return null;

  const timeLabel = formatHMS(msLeft);
  const ariaLabel = `${t('trial.countdownLabel')} ${timeLabel} — ${t('trial.addNumberCta')}`;

  return (
    <>
      {/* ── Pill button ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold surface-peach text-[var(--color-text-primary)] border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] hover:border-[var(--color-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      >
        {/* Hourglass icon — inline SVG so no extra import needed */}
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" />
        </svg>
        <span className="[font-variant-numeric:tabular-nums]">{timeLabel}</span>
        <span className="hidden sm:inline">{t('trial.addNumberCta')}</span>
      </button>

      <AddPhoneDialog open={open} onClose={() => setOpen(false)} onVerified={(status) => onPhoneAdded(status)} />
    </>
  );
}
