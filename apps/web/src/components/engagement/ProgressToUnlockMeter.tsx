'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { useHasMounted } from '@/components/motion/useHasMounted';
import '@vesta/shared/utils/i18n';

// ── useCountUp (mirrors StreakBadge local copy) ────────────────────────────────

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

// ── ProgressRing ─────────────────

interface ProgressRingProps {
  percent: number;
  displayPercent: number;
  size: number;
  stroke: number;
  prefersReducedMotion: boolean;
  mounted: boolean;
  incomplete: boolean;
  centerLabel?: boolean;
}

function ProgressRing({
  percent,
  displayPercent,
  size,
  stroke,
  prefersReducedMotion,
  mounted,
  incomplete,
  centerLabel = false,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const showGlow = mounted && !prefersReducedMotion && incomplete;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {showGlow && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, var(--goal-accent, var(--color-primary)) 0%, transparent 70%)',
            opacity: 0,
          }}
          animate={{ opacity: [0, 0.18, 0], scale: [0.85, 1.08, 0.85] }}
          transition={{
            duration: 3.2,
            ease: 'easeInOut',
            repeat: Infinity,
            repeatType: 'loop',
          }}
        />
      )}

      <svg
        width={size}
        height={size}
        className="rotate-[-90deg]"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        {mounted && !prefersReducedMotion ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--goal-accent, var(--color-primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--goal-accent, var(--color-primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>

      {centerLabel && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span
            className="font-extrabold tabular-nums leading-none"
            style={{
              fontSize: size >= 56 ? '0.875rem' : '0.5rem',
              color: 'var(--goal-accent, var(--color-primary))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayPercent}%
          </span>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProgressToUnlockMeterProps {
  cyclesLogged: number;
  unlockTarget: number;
  confidence: number; // 0..1 float
  tier: string | null;
  periodLogCount: number;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProgressToUnlockMeter({
  cyclesLogged,
  unlockTarget,
  confidence,
  tier: _tier,
  periodLogCount,
  className,
}: ProgressToUnlockMeterProps) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prm = mounted && reduceRaw;

  const confidencePercent = Math.round(confidence * 100);
  const isUnlocked = cyclesLogged >= unlockTarget;
  const inProgress = !isUnlocked && periodLogCount > cyclesLogged;
  const inProgressCycleNum = cyclesLogged + 1;
  const effectiveProgress = cyclesLogged + (inProgress ? 0.5 : 0);
  const ringPercent = Math.min(effectiveProgress / Math.max(unlockTarget, 1), 1) * 100;

  const countUpEnabled = mounted && !prm;
  const displayConfidence = useCountUp(confidencePercent, countUpEnabled);

  const cardContent = (
    <Card padding="md" className={className}>
      <div aria-live="polite" className="flex items-start gap-4">
        {/* Progress ring — decorative, aria-hidden */}
        <div aria-hidden="true" className="shrink-0">
          <ProgressRing
            percent={ringPercent}
            displayPercent={displayConfidence}
            size={72}
            stroke={7}
            prefersReducedMotion={prm}
            mounted={mounted}
            incomplete={!isUnlocked}
          />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
            {t('progress.unlockTitle')}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            {isUnlocked
              ? t('progress.unlockReached')
              : t('progress.unlockBody', { count: cyclesLogged, target: unlockTarget })}
          </p>
          {inProgress && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
              {t('progress.inProgress', { n: inProgressCycleNum })}
            </p>
          )}
          <p
            className="text-xs font-semibold tabular-nums mt-1"
            style={{
              color: 'var(--goal-accent, var(--color-primary))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('progress.confidence', { percent: displayConfidence })}
          </p>
        </div>
      </div>
    </Card>
  );

  if (prm || !mounted) {
    return cardContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      {cardContent}
    </motion.div>
  );
}
