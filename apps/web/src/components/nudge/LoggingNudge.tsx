'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { Sparkles, CalendarPlus, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoggingNudgeProps {
  profileId: string;
  hasAnyLogs: boolean;             // false → empty-state variant
  daysSinceLastLog: number | null; // null when no logs; >= 3 → stale variant
  goal?: string | null;            // 'conceive' → TTC-tailored copy
  onLogPeriod?: () => void;        // primary CTA callback; if absent, CTA is a <Link href="/calendar">
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LoggingNudge({
  profileId,
  hasAnyLogs,
  daysSinceLastLog,
  goal,
  onLogPeriod,
  className,
}: LoggingNudgeProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  const DISMISSED_KEY = `vesta_nudge_dismissed_${profileId}`;

  // Only read sessionStorage after mounted to avoid SSR mismatch
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (mounted) {
      setDismissed(!!sessionStorage.getItem(DISMISSED_KEY));
    }
  }, [mounted, DISMISSED_KEY]);

  // Determine which variant to show
  const isEmptyState = !hasAnyLogs;
  const isStale =
    hasAnyLogs &&
    daysSinceLastLog != null &&
    daysSinceLastLog >= 3;

  // Neither condition met → render null
  if (!isEmptyState && !isStale) return null;
  // Dismissed → render null
  if (dismissed) return null;

  // Resolve copy keys
  const isTTC = goal === 'conceive';

  let title: string;
  let description: string;
  let ctaLabel: string;

  if (isEmptyState) {
    title = isTTC ? t('nudge.conceiveTitle') : t('nudge.emptyTitle');
    description = isTTC ? t('nudge.conceiveDescription') : t('nudge.emptyDescription');
    ctaLabel = t('nudge.emptyCta');
  } else {
    // stale variant
    title = isTTC ? t('nudge.conceiveTitle') : t('nudge.staleTitle');
    description = isTTC ? t('nudge.conceiveDescription') : t('nudge.staleDescription');
    ctaLabel = t('nudge.staleCta');
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  const Icon = isEmptyState ? CalendarPlus : Sparkles;

  const content = (
    <Card
      className={[
        'relative overflow-hidden',
        className ?? '',
      ].join(' ').trim()}
      padding="md"
    >
      {/* Dismiss button */}
      <button
        type="button"
        aria-label={t('nudge.dismiss')}
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
      >
        <X size={14} aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {/* Accent icon */}
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
          }}
          aria-hidden="true"
        >
          {prefersReducedMotion ? (
            <Icon size={18} className="text-white" aria-hidden="true" />
          ) : (
            <motion.span
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center justify-center"
            >
              <Icon size={18} className="text-white" aria-hidden="true" />
            </motion.span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
            {title}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            {description}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Primary CTA */}
            {onLogPeriod ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onLogPeriod}
                className="text-xs"
              >
                {ctaLabel}
              </Button>
            ) : (
              <Link href="/calendar">
                <Button variant="primary" size="sm" className="text-xs">
                  {ctaLabel}
                </Button>
              </Link>
            )}

            {/* Secondary CTA */}
            <Link
              href="/symptoms"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)] focus-visible:rounded-sm"
            >
              {t('nudge.logSymptomsCta')}
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );

  // Entrance animation (gated)
  if (prefersReducedMotion || !mounted) {
    return (
      <div aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <motion.div
      aria-live="polite"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {content}
    </motion.div>
  );
}
