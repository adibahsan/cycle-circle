'use client';

import React, { useId, useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Mail, Phone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompletionItem {
  key: string;
  done: boolean;
}

export interface RecommendedContact {
  key: 'email' | 'phone';
  done: boolean;
}

export interface ProfileCompletionStatus {
  percent: number;
  complete: boolean;
  items: CompletionItem[];
  recommended: RecommendedContact;
}

export interface ProfileCompletionTrackerProps {
  status: ProfileCompletionStatus;
  variant?: 'card' | 'header' | 'pill';  // default 'card'
  onComplete?: () => void;               // opens the profile-completion modal
  className?: string;
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
    return { type: 'link', href: '/settings#account' };
  }
  if (key === 'goal' || key === 'cycleHistory') {
    return { type: 'link', href: '/profiles' };
  }
  // firstLog
  return { type: 'link', href: '/calendar' };
}

// ── Progress Ring (card variant) ─────────────────────────────────────────────

interface ProgressRingProps {
  percent: number;
  size: number;
  stroke: number;
  prefersReducedMotion: boolean;
  mounted: boolean;
}

function ProgressRing({
  percent,
  size,
  stroke,
  prefersReducedMotion,
  mounted,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
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
      {/* Progress */}
      {mounted && !prefersReducedMotion ? (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />
      ) : (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      )}
    </svg>
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
        className="text-[var(--color-border)] shrink-0 group-hover:text-[var(--color-primary)] transition-colors"
        aria-hidden="true"
      />
      <span className="flex-1 text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
        {label}
      </span>
      <span className="text-xs font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {t('profileCompletion.itemAction')}
      </span>
    </div>
  );

  if (cta.type === 'callback') {
    return (
      <button
        type="button"
        onClick={cta.fn}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] rounded-xl"
        aria-label={label}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={cta.href}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] rounded-xl"
    >
      {inner}
    </Link>
  );
}

// ── DoneItem ──────────────────────────────────────────────────────────────────

function DoneItem({ itemKey }: { itemKey: string }) {
  const label = useItemLabel(itemKey);
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-3">
      <CheckCircle2 size={15} className="text-[var(--color-secondary)] shrink-0" aria-hidden="true" />
      <span className="text-xs text-[var(--color-text-muted)] line-through">{label}</span>
    </div>
  );
}

// ── RecommendedBlock ──────────────────────────────────────────────────────────

function RecommendedBlock({
  recommended,
  onComplete,
}: {
  recommended: RecommendedContact;
  onComplete?: () => void;
}) {
  const { t } = useTranslation();

  const label =
    recommended.key === 'email'
      ? t('profileCompletion.recommendedEmail')
      : t('profileCompletion.recommendedPhone');

  const Icon = recommended.key === 'email' ? Mail : Phone;

  const rowInner = (
    <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] transition-colors group">
      <Icon
        size={15}
        className="text-[var(--color-text-muted)] shrink-0 group-hover:text-[var(--color-primary)] transition-colors"
        aria-hidden="true"
      />
      <span className="flex-1 text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
        {label}
      </span>
      <span className="text-xs font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {t('profileCompletion.recommendedCta')}
      </span>
    </div>
  );

  const row =
    recommended.key === 'email' ? (
      <Link
        href="/settings#account"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] rounded-xl"
      >
        {rowInner}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onComplete}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] rounded-xl"
        aria-label={label}
      >
        {rowInner}
      </button>
    );

  return (
    <div className="border-t border-[var(--color-border)] pt-3 mt-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 px-1">
        {t('profileCompletion.recommendedTitle')}
      </p>
      {row}
    </div>
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

  // Pill variant expand/collapse state — always initialised to false for SSR safety.
  // The stored preference is applied client-side in a useEffect after mount.
  const [expanded, setExpanded] = useState(false);
  const pillPanelId = useId();

  useEffect(() => {
    if (variant === 'pill') {
      try {
        const stored = localStorage.getItem('vesta_completion_pill_expanded');
        if (stored === '1') setExpanded(true);
      } catch {
        // localStorage unavailable — silently ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty: runs once after mount

  const recommendedDone = status.recommended?.done ?? true;

  // Header variant: hide at 100% (unchanged behaviour)
  // Card / pill variants: hide only when core is complete AND recommended is done
  if (variant === 'header') {
    if (status.complete) return null;
  } else {
    if (status.complete && recommendedDone) return null;
  }

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
          'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
          'hover:border-[var(--color-primary)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
          className ?? '',
        ]
          .join(' ')
          .trim()}
      >
        {/* Mini ring */}
        <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }} aria-hidden="true">
          <ProgressRing
            percent={status.percent}
            size={RING_SIZE}
            stroke={RING_STROKE}
            prefersReducedMotion={prefersReducedMotion}
            mounted={mounted}
          />
          {/* Percent in center */}
          <div
            className="absolute inset-0 flex items-center justify-center text-[8px] font-bold tabular-nums"
            style={{ color: 'var(--color-primary)' }}
          >
            {status.percent}
          </div>
        </div>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {t('profileCompletion.headerLabel')}
        </span>
      </button>
    );
  }

  // ── Pill variant ─────────────────────────────────────────────────────────────
  if (variant === 'pill') {
    const PILL_RING_SIZE = 28;
    const PILL_RING_STROKE = 3;
    const showRecommendedPill = status.recommended && !status.recommended.done;

    const expandLabel = t('profileCompletion.expandLabel');
    const collapseLabel = t('profileCompletion.collapseLabel');
    const toggleAriaLabel = expanded
      ? `${collapseLabel} — ${t('profileCompletion.percentComplete', { percent: status.percent })}`
      : `${expandLabel} — ${t('profileCompletion.percentComplete', { percent: status.percent })}`;

    const handleToggle = () => {
      setExpanded((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('vesta_completion_pill_expanded', next ? '1' : '0');
        } catch {
          // ignore
        }
        return next;
      });
    };

    return (
      <div className={['w-full', className ?? ''].join(' ').trim()}>
        {/* ── Collapsed row / toggle button ── */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={pillPanelId}
          aria-label={toggleAriaLabel}
          onClick={handleToggle}
          className={[
            'w-full flex items-center gap-3 px-4 rounded-xl',
            'bg-[var(--color-bg-card)] border border-[var(--color-border)]',
            'hover:border-[var(--color-primary)] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
            'min-h-[48px]',
          ].join(' ')}
        >
          {/* Mini progress ring */}
          <div
            className="relative shrink-0"
            style={{ width: PILL_RING_SIZE, height: PILL_RING_SIZE }}
            aria-hidden="true"
          >
            <ProgressRing
              percent={status.percent}
              size={PILL_RING_SIZE}
              stroke={PILL_RING_STROKE}
              prefersReducedMotion={prefersReducedMotion}
              mounted={mounted}
            />
            <div
              className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
              style={{ color: 'var(--color-primary)' }}
              aria-hidden="true"
            >
              {status.percent}
            </div>
          </div>

          {/* Labels */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {t('profileCompletion.title')}
            </span>
            <span
              className="text-xs font-semibold shrink-0 tabular-nums"
              style={{
                color: 'var(--color-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t('profileCompletion.percentComplete', { percent: status.percent })}
            </span>
          </div>

          {/* Chevron */}
          <div
            className={[
              'shrink-0 text-[var(--color-text-muted)]',
              !prefersReducedMotion ? 'transition-transform duration-200' : '',
              expanded ? 'rotate-0' : '',
            ].join(' ')}
            aria-hidden="true"
          >
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </div>
        </button>

        {/* ── Expandable panel ── */}
        {prefersReducedMotion ? (
          expanded ? (
            <div
              id={pillPanelId}
              role="region"
              aria-label={t('profileCompletion.title')}
              aria-live="polite"
              className="pt-2"
            >
              {/* Pending items */}
              {pendingItems.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-3">
                  {pendingItems.map((item) => (
                    <ChecklistItem
                      key={item.key}
                      itemKey={item.key}
                      onComplete={onComplete}
                    />
                  ))}
                </div>
              )}
              {/* Done items */}
              {status.items.filter((i) => i.done).length > 0 && (
                <div className="flex flex-col gap-1 mb-3 opacity-50">
                  {status.items.filter((i) => i.done).map((item) => (
                    <DoneItem key={item.key} itemKey={item.key} />
                  ))}
                </div>
              )}
              {!status.complete && (
                <Button variant="primary" size="sm" fullWidth onClick={onComplete} className="text-xs mb-2">
                  {t('profileCompletion.completeCta')}
                </Button>
              )}
              {showRecommendedPill && (
                <RecommendedBlock recommended={status.recommended} onComplete={onComplete} />
              )}
            </div>
          ) : null
        ) : (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id={pillPanelId}
                role="region"
                aria-label={t('profileCompletion.title')}
                aria-live="polite"
                key="pill-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="pt-2">
                  {/* Pending items */}
                  {pendingItems.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-3">
                      {pendingItems.map((item) => (
                        <ChecklistItem
                          key={item.key}
                          itemKey={item.key}
                          onComplete={onComplete}
                        />
                      ))}
                    </div>
                  )}
                  {/* Done items */}
                  {status.items.filter((i) => i.done).length > 0 && (
                    <div className="flex flex-col gap-1 mb-3 opacity-50">
                      {status.items.filter((i) => i.done).map((item) => (
                        <DoneItem key={item.key} itemKey={item.key} />
                      ))}
                    </div>
                  )}
                  {!status.complete && (
                    <Button variant="primary" size="sm" fullWidth onClick={onComplete} className="text-xs mb-2">
                      {t('profileCompletion.completeCta')}
                    </Button>
                  )}
                  {showRecommendedPill && (
                    <RecommendedBlock recommended={status.recommended} onComplete={onComplete} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }

  // ── Card variant ─────────────────────────────────────────────────────────────
  const RING_SIZE = 64;
  const RING_STROKE = 6;

  const showRecommended = status.recommended && !status.recommended.done;

  const cardContent = (
    <Card
      className={className}
      padding="md"
    >
      <div aria-live="polite">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Ring */}
          <div
            className="relative shrink-0"
            style={{ width: RING_SIZE, height: RING_SIZE }}
            aria-hidden="true"
          >
            <ProgressRing
              percent={status.percent}
              size={RING_SIZE}
              stroke={RING_STROKE}
              prefersReducedMotion={prefersReducedMotion}
              mounted={mounted}
            />
            {/* Percent in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-sm font-extrabold tabular-nums leading-none"
                style={{ color: 'var(--color-primary)' }}
              >
                {status.percent}%
              </span>
            </div>
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
              style={{ color: 'var(--color-secondary)' }}
            >
              {t('profileCompletion.percentComplete', { percent: status.percent })}
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

        {/* Recommended subsection */}
        {showRecommended && (
          <RecommendedBlock
            recommended={status.recommended}
            onComplete={onComplete}
          />
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
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {cardContent}
    </motion.div>
  );
}
