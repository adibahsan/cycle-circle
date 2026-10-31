'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { Sparkles, CalendarPlus, X, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/** A navigation CTA styled like the primary small Button (a link, never a button inside a link). */
const CTA_LINK_CLASS =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--color-on-action)] shadow-soft transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]';
import { GOAL_ACCENT_FILL } from '@/components/ui/action-styles';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { isTTC, goalAccentVar } from '@vesta/shared/utils/goal';
import { loggingNudgeVariant } from '@/lib/prompt-rules';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoggingNudgeProps {
  profileId: string;
  hasAnyLogs: boolean;             // false → empty-state variant
  daysSinceLastLog: number | null; // null when no logs; >= 3 → stale variant
  goal?: string | null;            // 'conceive' → TTC-tailored copy
  onLogPeriod?: () => void;        // primary CTA callback; if absent, CTA is a <Link href="/calendar">
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
  phase,
  className,
}: LoggingNudgeProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  const NUDGE_SNOOZE_DAYS = 3;
  const DISMISSED_KEY = `vesta_nudge_dismissed_${profileId}`;
  // Cross-session frequency cap: after a dismissal stay quiet for a few days
  // (not just the current session) to avoid logging-nudge fatigue.
  const SNOOZE_KEY = `vesta_nudge_snooze_until_${profileId}`;

  // Only read storage after mounted to avoid SSR mismatch
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true);
      return;
    }
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (snoozeUntil && Date.now() < snoozeUntil) setDismissed(true);
  }, [mounted, DISMISSED_KEY, SNOOZE_KEY]);

  // Dismissed, or fewer than 3 days since the last log → render null
  const variant = loggingNudgeVariant({ hasAnyLogs, daysSinceLastLog });
  if (!variant || dismissed) return null;
  const isEmptyState = variant === 'empty';

  // Resolve copy keys
  const goalIsTTC = isTTC(goal);
  const accentVar = goalAccentVar(goal);

  let title: string;
  let description: string;
  let ctaLabel: string;
  let Icon: LucideIcon;

  if (isEmptyState) {
    if (goalIsTTC) {
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
    if (goalIsTTC) {
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
    // Snooze across sessions so the nudge does not reappear on every visit.
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + NUDGE_SNOOZE_DAYS * 86_400_000));
    setDismissed(true);
  }

  const content = (
    <Card
      className={[
        '@container relative overflow-hidden',
        className ?? '',
      ].join(' ').trim()}
      tone="panel"
      padding="sm"
      style={{
        ['--goal-accent']: accentVar,
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
        className="absolute top-1 right-1 z-20 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 px-2 py-1 pr-10">
        {/* Accent icon */}
        <div
          className="relative shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--goal-accent) 0%, color-mix(in srgb, var(--goal-accent) 65%, var(--color-bg-primary)) 100%)',
          }}
          aria-hidden="true"
        >
          <Icon size={18} className="text-[var(--color-on-accent)]" aria-hidden="true" />
        </div>

        {/* Text, then the actions: stacked when narrow, one row when the card is wide. */}
        <div className="flex min-w-0 flex-1 flex-col @2xl:flex-row @2xl:items-center @2xl:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
              {title}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed text-pretty max-w-prose">
              {description}
            </p>

            {/* Phase-aware enrichment (only when phase provided) */}
            {phase && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 opacity-80 leading-relaxed">
                {t('nudge.phaseAwareBody', { phase: t(`dashboard.${phase.toLowerCase()}`) })}
              </p>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-2 flex flex-wrap items-center gap-2 @2xl:mt-0 @2xl:shrink-0">
            {isEmptyState ? (
              <>
                {/* Empty-state: Primary CTA — Log first period */}
                {onLogPeriod ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onLogPeriod}
                    className="text-xs focus-visible:ring-[var(--goal-accent)]"
                    style={GOAL_ACCENT_FILL}
                  >
                    {ctaLabel}
                  </Button>
                ) : (
                  <Link
                    href="/calendar"
                    className={CTA_LINK_CLASS}
                    style={GOAL_ACCENT_FILL}
                  >
                    {ctaLabel}
                  </Link>
                )}

                {/* Secondary CTA */}
                <Link
                  href="/symptoms"
                  className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] focus-visible:rounded-sm"
                  style={{ color: 'var(--goal-accent)' } as React.CSSProperties}
                >
                  {t('nudge.logSymptomsCta')}
                </Link>
              </>
            ) : (
              /* Stale variant: single primary CTA — Log symptoms */
              <Link href="/symptoms" className={CTA_LINK_CLASS} style={GOAL_ACCENT_FILL}>
                {t('nudge.logSymptomsCta')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  // Entrance animation (gated)
  if (prefersReducedMotion || !mounted) {
    return (
      <div aria-live="polite" data-testid="logging-nudge">
        {content}
      </div>
    );
  }

  return (
    <motion.div
      aria-live="polite"
      data-testid="logging-nudge"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.div>
  );
}
