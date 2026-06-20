'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { Sparkles, CalendarPlus, Flame, X, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { isTTC, isPregnancy, goalAccentVar } from '@vesta/shared/utils/goal';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoggingNudgeProps {
  profileId: string;
  hasAnyLogs: boolean;             // false → empty-state variant
  daysSinceLastLog: number | null; // null when no logs; >= 3 → stale variant
  goal?: string | null;            // 'conceive' → TTC-tailored copy
  onLogPeriod?: () => void;        // primary CTA callback; if absent, CTA is a <Link href="/calendar">
  onLogSymptoms?: () => void;      // secondary CTA callback; if absent, CTA is a <Link href="/symptoms">
  streak?: number;                 // current streak count
  streakAtRisk?: boolean;          // true → streak-at-risk variant (highest priority)
  phase?: string | null;           // current cycle phase for phase-aware enrichment
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LoggingNudge({
  profileId,
  hasAnyLogs,
  daysSinceLastLog,
  goal,
  onLogPeriod,
  onLogSymptoms,
  streak,
  streakAtRisk,
  phase,
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

  // Determine which variant to show (priority: streakAtRisk > empty > stale)
  const isStreakAtRisk = !!streakAtRisk && (streak ?? 0) > 0;
  const isEmptyState = !hasAnyLogs;
  const isStale =
    hasAnyLogs &&
    daysSinceLastLog != null &&
    daysSinceLastLog >= 3;

  // None of the conditions met → render null
  if (!isStreakAtRisk && !isEmptyState && !isStale) return null;
  // Dismissed → render null
  if (dismissed) return null;

  // Resolve copy keys — streak-at-risk takes highest priority
  const goalIsPregnancy = isPregnancy(goal);
  const goalIsTTC = isTTC(goal);
  const accentVar = goalAccentVar(goal);

  let title: string;
  let description: string;
  let ctaLabel: string;
  let Icon: LucideIcon;

  if (isStreakAtRisk) {
    title = t('nudge.streakAtRiskTitle');
    description = t('nudge.streakAtRiskBody', { count: streak ?? 0 });
    ctaLabel = t('nudge.logSymptomsCta');
    Icon = Flame;
  } else if (isEmptyState) {
    if (goalIsPregnancy) {
      title = t('nudge.pregnancyTitle');
      description = t('nudge.pregnancyDescription');
    } else if (goalIsTTC) {
      title = t('nudge.conceiveTitle');
      description = t('nudge.conceiveDescription');
    } else {
      title = t('nudge.emptyTitle');
      description = t('nudge.emptyDescription');
    }
    ctaLabel = t('nudge.emptyCta');
    Icon = CalendarPlus;
  } else {
    // stale variant
    if (goalIsPregnancy) {
      title = t('nudge.pregnancyTitle');
      description = t('nudge.pregnancyDescription');
    } else if (goalIsTTC) {
      title = t('nudge.conceiveTitle');
      description = t('nudge.conceiveDescription');
    } else {
      title = t('nudge.staleTitle');
      description = t('nudge.staleDescription');
    }
    ctaLabel = t('nudge.staleCta');
    Icon = Sparkles;
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  const content = (
    <Card
      className={[
        'relative overflow-hidden',
        className ?? '',
      ].join(' ').trim()}
      padding="md"
      style={{
        ['--goal-accent']: accentVar,
        boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--goal-accent) 30%, transparent), 0 4px 20px color-mix(in srgb, var(--goal-accent) 12%, transparent)',
      } as React.CSSProperties}
    >
      {/* One-shot accent sheen sweep — absolutely-positioned overlay, gated */}
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ transform: 'translateX(-120%)' }}
          animate={{ transform: 'translateX(120%)' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            willChange: 'transform',
            background:
              'linear-gradient(105deg, transparent 20%, color-mix(in srgb, var(--goal-accent) 18%, transparent) 50%, transparent 80%)',
          }}
        />
      )}

      {/* Dismiss button */}
      <button
        type="button"
        aria-label={t('nudge.dismiss')}
        onClick={handleDismiss}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
      >
        <X size={14} aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {/* Accent icon */}
        <div
          className="relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--goal-accent) 0%, color-mix(in srgb, var(--goal-accent) 65%, var(--color-bg-primary)) 100%)',
          }}
          aria-hidden="true"
        >
          {prefersReducedMotion ? (
            <Icon size={18} className="text-white" aria-hidden="true" />
          ) : (
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
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

          {/* Phase-aware enrichment (only when phase provided and NOT streak-at-risk) */}
          {!isStreakAtRisk && phase && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 opacity-80 leading-relaxed">
              {t('nudge.phaseAwareBody', { phase })}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {isStreakAtRisk ? (
              /* Streak-at-risk: single CTA → log symptoms */
              onLogSymptoms ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onLogSymptoms}
                  className="text-xs focus-visible:ring-[var(--goal-accent)]"
                  style={{
                    background: 'var(--goal-accent)',
                    borderColor: 'var(--goal-accent)',
                  } as React.CSSProperties}
                >
                  {ctaLabel}
                </Button>
              ) : (
                <Link href="/symptoms">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      background: 'var(--goal-accent)',
                      borderColor: 'var(--goal-accent)',
                    } as React.CSSProperties}
                  >
                    {ctaLabel}
                  </Button>
                </Link>
              )
            ) : isEmptyState ? (
              <>
                {/* Empty-state: Primary CTA — Log first period */}
                {onLogPeriod ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onLogPeriod}
                    className="text-xs focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      background: 'var(--goal-accent)',
                      borderColor: 'var(--goal-accent)',
                    } as React.CSSProperties}
                  >
                    {ctaLabel}
                  </Button>
                ) : (
                  <Link href="/calendar">
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs focus-visible:ring-[var(--goal-accent)]"
                      style={{
                        background: 'var(--goal-accent)',
                        borderColor: 'var(--goal-accent)',
                      } as React.CSSProperties}
                    >
                      {ctaLabel}
                    </Button>
                  </Link>
                )}

                {/* Secondary CTA */}
                {onLogSymptoms ? (
                  <button
                    type="button"
                    onClick={onLogSymptoms}
                    className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] focus-visible:rounded-sm"
                    style={{ color: 'var(--goal-accent)' } as React.CSSProperties}
                  >
                    {t('nudge.logSymptomsCta')}
                  </button>
                ) : (
                  <Link
                    href="/symptoms"
                    className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] focus-visible:rounded-sm"
                    style={{ color: 'var(--goal-accent)' } as React.CSSProperties}
                  >
                    {t('nudge.logSymptomsCta')}
                  </Link>
                )}
              </>
            ) : (
              /* Stale variant: single primary CTA — Log symptoms */
              onLogSymptoms ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onLogSymptoms}
                  className="text-xs focus-visible:ring-[var(--goal-accent)]"
                  style={{
                    background: 'var(--goal-accent)',
                    borderColor: 'var(--goal-accent)',
                  } as React.CSSProperties}
                >
                  {t('nudge.logSymptomsCta')}
                </Button>
              ) : (
                <Link href="/symptoms">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      background: 'var(--goal-accent)',
                      borderColor: 'var(--goal-accent)',
                    } as React.CSSProperties}
                  >
                    {t('nudge.logSymptomsCta')}
                  </Button>
                </Link>
              )
            )}
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.div>
  );
}
