'use client';

import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { HeartHandshake } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { goalAccentVar } from '@vesta/shared/utils/goal';
import '@vesta/shared/utils/i18n';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LatePeriodPromptProps {
  open: boolean;
  onClose: () => void;
  daysLate: number;
  goal: string | null;
  onLogPeriod: () => void; // opens the existing PeriodLogModal flow (owner provides)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LatePeriodPrompt({
  open,
  onClose,
  daysLate,
  goal,
  onLogPeriod,
}: LatePeriodPromptProps) {
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prefersReducedMotion = mounted && reduceRaw;

  const accentVar = goalAccentVar(goal);

  function handleLogPeriod() {
    onClose();
    onLogPeriod();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="late-period-title"
      descId="late-period-desc"
      accentVar={accentVar}
    >
      {/* Content root: scope --goal-accent for all descendants */}
      <div
        className="px-6 pb-6 pt-4 flex flex-col items-center text-center gap-4"
        style={{ ['--goal-accent' as string]: accentVar }}
      >
        {/* Header icon badge */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--goal-accent) 14%, transparent)',
          }}
          aria-hidden="true"
        >
          {prefersReducedMotion || !mounted ? (
            <HeartHandshake
              size={28}
              aria-hidden="true"
              style={{ color: 'var(--goal-accent)' }}
            />
          ) : (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280, delay: 0.05 }}
              className="flex items-center justify-center"
              style={
                {
                  willChange: 'transform, opacity',
                } as React.CSSProperties
              }
            >
              {/* Subtle breathe loop */}
              <motion.span
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center justify-center"
              >
                <HeartHandshake
                  size={28}
                  aria-hidden="true"
                  style={{ color: 'var(--goal-accent)' }}
                />
              </motion.span>
            </motion.span>
          )}
        </div>

        {/* Title */}
        <h2
          id="late-period-title"
          className="text-lg font-bold text-[var(--color-text-primary)] leading-snug"
        >
          {t('latePeriod.title')}
        </h2>

        {/* Body */}
        <p
          id="late-period-desc"
          className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xs"
        >
          {t('latePeriod.body', { count: daysLate })}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full mt-1">
          {/* Primary CTA — tinted with goal accent */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleLogPeriod}
            className="focus-visible:ring-[var(--goal-accent)]"
            style={{
              background: 'var(--goal-accent)',
              borderColor: 'var(--goal-accent)',
            } as React.CSSProperties}
          >
            {t('latePeriod.logCta')}
          </Button>

          {/* Secondary / ghost CTA */}
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={onClose}
            className="focus-visible:ring-[var(--goal-accent)]"
          >
            {t('latePeriod.later')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
