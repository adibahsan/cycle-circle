'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletionItem {
  key: string;
  done: boolean;
}

export interface ProfileCompletionStatus {
  percent: number;
  complete: boolean;
  items: CompletionItem[];
}

export interface ProfileCompletionTrackerProps {
  status: ProfileCompletionStatus;
  variant?: 'card' | 'header';  // default 'card'
  onComplete?: () => void;               // opens the profile-completion modal
  className?: string;
}

// ── useCountUp ────────────────────────────────────────────────────────────────
// Animates an integer from 0 → target over ~0.8s using easeOutCubic via rAF.
// When `enabled` is false (prefers-reduced-motion or not yet mounted) it returns
// `target` immediately, which is also what renders on the server — so SSR and
// the first client paint both emit the same static value; the animation only
// starts after mount + gate confirmation.

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, enabled: boolean): number {
  // Start at target (deterministic SSR value). The rAF animation overwrites
  // this after mount only when `enabled` is true.
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    // Cancel any in-flight animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!enabled) {
      setValue(target);
      prevTargetRef.current = target;
      return;
    }

    // Only re-run when target actually changes (or on first enabled mount)
    if (prevTargetRef.current === target && value === target) return;

    const DURATION = 800; // ms
    const start = performance.now();
    const from = 0; // always count up from 0 for a satisfying entrance

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      const easedValue = Math.round(from + (target - from) * easeOutCubic(progress));
      setValue(easedValue);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        prevTargetRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);

  return value;
}

// ── Item label / CTA map ──────────────────────────────────────────────────────

type ItemKey = 'fullName' | 'phone' | 'email' | 'goal' | 'cycleHistory' | 'firstLog';

function useItemLabel(key: string): string {
  const { t } = useTranslation();
  const map: Record<ItemKey, string> = {
    fullName: t('profileCompletion.itemFullName'),
    phone: t('profileCompletion.itemPhone'),
    email: t('profileCompletion.itemEmail'),
    goal: t('profileCompletion.itemGoal'),
    cycleHistory: t('profileCompletion.itemCycleHistory'),
    firstLog: t('profileCompletion.itemFirstLog'),
  };
  return map[key as ItemKey] ?? key;
}

// Per-item CTA — returns either a callback or an href
function getItemCta(
  key: string,
  onComplete?: () => void,
): { type: 'callback'; fn: () => void } | { type: 'link'; href: string } {
  if (key === 'fullName' || key === 'phone') {
    return { type: 'callback', fn: onComplete ?? (() => {}) };
  }
  if (key === 'email') {
    return { type: 'callback', fn: onComplete ?? (() => {}) };
  }
  if (key === 'goal' || key === 'cycleHistory') {
    return { type: 'link', href: '/profiles' };
  }
  // firstLog
  return { type: 'link', href: '/calendar' };
}

// ── Progress Ring ─────────────────────────────────────────────────────────────

interface ProgressRingProps {
  percent: number;
  displayPercent: number; // driven by useCountUp for center label
  size: number;
  stroke: number;
  prefersReducedMotion: boolean;
  mounted: boolean;
  incomplete: boolean;   // drives glow-pulse when true
  centerLabel?: boolean; // render center percent label inside ring
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

  // Glow: visible only when mounted, motion allowed, and profile is incomplete
  const showGlow = mounted && !prefersReducedMotion && incomplete;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Soft breathe-glow halo behind the ring (opacity+scale pulse) */}
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
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
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

      {/* Optional center label */}
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

// ── ChecklistItem ─────────────────────────────────────────────────────────────

function ChecklistItem({
  itemKey,
  onComplete,
}: {
  itemKey: string;
  onComplete?: () => void;
}) {
  const label = useItemLabel(itemKey);
  const cta = getItemCta(itemKey, onComplete);
  const { t } = useTranslation();

  const inner = (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] transition-colors group">
      <Circle
        size={15}
        className="text-[var(--color-border)] shrink-0 group-hover:text-[var(--goal-accent)] transition-colors"
        aria-hidden="true"
      />
      <span className="flex-1 text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
      <span className="text-xs font-semibold text-[var(--goal-accent)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {t('profileCompletion.itemAction')}
      </span>
    </div>
  );

  if (cta.type === 'callback') {
    return (
      <button
        type="button"
        onClick={cta.fn}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent)] rounded-xl"
        aria-label={label}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={cta.href}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent)] rounded-xl"
    >
      {inner}
    </Link>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileCompletionTracker({
  status,
  variant = 'card',
  onComplete,
  className,
}: ProfileCompletionTrackerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  // Count-up is only enabled after mount AND when reduced-motion is not requested.
  // On the server and on the first client render, useCountUp returns target directly
  // (because enabled=false), so SSR HTML matches the first paint — no hydration mismatch.
  const countUpEnabled = mounted && !prefersReducedMotion;
  const displayPercent = useCountUp(status.percent, countUpEnabled);

  // All variants hide at 100%. `complete` now requires every item — including
  // both contact methods — so reaching 100% genuinely means nothing is pending.
  if (status.complete) return null;

  const pendingItems = status.items.filter((item) => !item.done);

  // ── Header variant ───────────────────────────────────────────────────────────
  if (variant === 'header') {
    const RING_SIZE = 28;
    const RING_STROKE = 3;

    return (
      <button
        type="button"
        onClick={onComplete}
        aria-label={t('profileCompletion.headerAriaLabel', {
          percent: status.percent,
        })}
        className={[
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
          'surface-peach border border-[var(--color-border)]',
          'hover:border-[var(--goal-accent)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]',
          className ?? '',
        ]
          .join(' ')
          .trim()}
      >
        {/* Mini ring with center label */}
        <div aria-hidden="true">
          <ProgressRing
            percent={status.percent}
            displayPercent={displayPercent}
            size={RING_SIZE}
            stroke={RING_STROKE}
            prefersReducedMotion={prefersReducedMotion}
            mounted={mounted}
            incomplete={!status.complete}
            centerLabel
          />
        </div>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {t('profileCompletion.headerLabel')}
        </span>
      </button>
    );
  }


  // ── Card variant ─────────────────────────────────────────────────────────────
  const RING_SIZE = 64;
  const RING_STROKE = 6;

  const cardContent = (
    <Card
      className={className}
      padding="md"
    >
      <div aria-live="polite">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Ring with center percent label driven by count-up */}
          <div aria-hidden="true">
            <ProgressRing
              percent={status.percent}
              displayPercent={displayPercent}
              size={RING_SIZE}
              stroke={RING_STROKE}
              prefersReducedMotion={prefersReducedMotion}
              mounted={mounted}
              incomplete={!status.complete}
              centerLabel
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
              {t('profileCompletion.title')}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
              {t('profileCompletion.subtitle')}
            </p>
            <p
              className="text-xs font-semibold tabular-nums mt-1"
              style={{
                color: 'var(--goal-accent, var(--color-primary))',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t('profileCompletion.percentComplete', { percent: displayPercent })}
            </p>
          </div>
        </div>

        {/* Pending checklist */}
        {pendingItems.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4">
            {pendingItems.map((item) => (
              <ChecklistItem
                key={item.key}
                itemKey={item.key}
                onComplete={onComplete}
              />
            ))}
          </div>
        )}

        {/* Done items (greyed out) */}
        {status.items.filter((i) => i.done).length > 0 && (
          <div className="flex flex-col gap-1 mb-4 opacity-50">
            {status.items
              .filter((i) => i.done)
              .map((item) => {
                const label = item.key === 'fullName'
                  ? t('profileCompletion.itemFullName')
                  : item.key === 'phone'
                    ? t('profileCompletion.itemPhone')
                    : item.key === 'email'
                      ? t('profileCompletion.itemEmail')
                      : item.key === 'goal'
                        ? t('profileCompletion.itemGoal')
                        : item.key === 'cycleHistory'
                          ? t('profileCompletion.itemCycleHistory')
                          : t('profileCompletion.itemFirstLog');
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5 py-1.5 px-3"
                  >
                    <CheckCircle2
                      size={15}
                      className="text-[var(--color-secondary)] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-xs text-[var(--color-text-muted)] line-through">
                      {label}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Primary CTA — only shown when core is not yet complete */}
        {!status.complete && (
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={onComplete}
            className="text-xs"
          >
            {t('profileCompletion.completeCta')}
          </Button>
        )}
      </div>
    </Card>
  );

  // Entrance animation (gated)
  if (prefersReducedMotion || !mounted) {
    return cardContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {cardContent}
    </motion.div>
  );
}
