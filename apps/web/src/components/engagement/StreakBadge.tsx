'use client';

import { useRef, useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/components/motion/useHasMounted';
import '@vesta/shared/utils/i18n';

// ── useCountUp (local copy) ──

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!enabled) {
      setValue(target);
      prevTargetRef.current = target;
      return;
    }
    if (prevTargetRef.current === target && value === target) return;

    const DURATION = 700;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      setValue(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        prevTargetRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);

  return value;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StreakBadgeProps {
  streak: number;
  streakAtRisk: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StreakBadge({ streak, streakAtRisk, className }: StreakBadgeProps) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prm = mounted && reduceRaw;

  const displayCount = useCountUp(streak, mounted && !prm);

  const hasStreak = streak > 0;

  return (
    <div
      className={`inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${className ?? ''}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Flame icon — decorative, static */}
      <Flame
        size={18}
        aria-hidden="true"
        className="shrink-0"
        style={{ color: streakAtRisk ? 'var(--color-gold-ink)' : 'var(--goal-accent, var(--color-primary))' }}
      />

      {/* Count + label */}
      <div className="flex flex-col leading-tight">
        {hasStreak ? (
          <>
            <span
              className="text-base font-extrabold tabular-nums leading-none"
              style={{ color: streakAtRisk ? 'var(--color-gold-ink)' : 'var(--goal-accent, var(--color-primary))' }}
            >
              {displayCount}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium leading-none mt-0.5">
              {t('streak.count', { count: streak })}
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            {t('streak.start')}
          </span>
        )}
      </div>

      {/* At-risk helper text */}
      {streakAtRisk && hasStreak && (
        <span
          // Wraps under the count in a narrow card instead of pushing the Check in button out of it.
          className="min-w-0 text-[11px] font-semibold leading-snug px-2 py-0.5 rounded-lg"
          style={{
            color: 'var(--color-gold-ink)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
          }}
        >
          {t('streak.atRisk')}
        </span>
      )}
    </div>
  );
}
